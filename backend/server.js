const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { EMA, RSI } = require("technicalindicators");
require("dotenv").config();
const mongoose = require("mongoose");

const Portfolio = require("./models/Portfolio");
const Trade = require("./models/Trade");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = 5000;

// ==========================================
// TWELVE DATA CACHE
// ==========================================

// Current price cache: 30 seconds
const priceCache = new Map();

// Historical data cache: 5 minutes
const historyCache = new Map();

const PRICE_CACHE_TIME = 30 * 1000;
const HISTORY_CACHE_TIME = 5 * 60 * 1000;


// ==========================================
// TWELVE DATA - CURRENT PRICE
// ==========================================

const getCurrentPrice = async (symbol) => {
  const cached = priceCache.get(symbol);

  // Use cached price if still valid
  if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TIME) {
    return cached.price;
  }

  try {
    const response = await axios.get(
      "https://api.twelvedata.com/price",
      {
        params: {
          symbol,
          apikey: process.env.TWELVE_DATA_API_KEY
        }
      }
    );

    if (
      response.data.status === "error" ||
      !response.data.price
    ) {
      throw new Error(
        response.data.message || "Failed to get stock price"
      );
    }

    const price = Number(response.data.price);

    // Save to cache
    priceCache.set(symbol, {
      price,
      timestamp: Date.now()
    });

    return price;

  } catch (error) {
    if (error.response?.status === 429) {
      throw new Error(
        "Twelve Data API limit reached. Please wait a little and try again."
      );
    }

    throw error;
  }
};


// ==========================================
// TWELVE DATA - HISTORICAL DATA
// ==========================================

const getHistoricalData = async (symbol) => {
  const cached = historyCache.get(symbol);

  // Use cached history if still valid
  if (
    cached &&
    Date.now() - cached.timestamp < HISTORY_CACHE_TIME
  ) {
    return cached.data;
  }

  try {
    const response = await axios.get(
      "https://api.twelvedata.com/time_series",
      {
        params: {
          symbol,
          interval: "1day",
          outputsize: 100,
          apikey: process.env.TWELVE_DATA_API_KEY
        }
      }
    );

    if (
      response.data.status === "error" ||
      !response.data.values
    ) {
      throw new Error(
        response.data.message || "Failed to get historical data"
      );
    }

    const data = response.data;

    // Save to cache
    historyCache.set(symbol, {
      data,
      timestamp: Date.now()
    });

    return data;

  } catch (error) {
    if (error.response?.status === 429) {
      throw new Error(
        "Twelve Data API limit reached. Please wait a little and try again."
      );
    }

    throw error;
  }
};


// ==========================================
// TEST ROUTE
// ==========================================

app.get("/", (req, res) => {
  res.json({
    message: "Trading Bot API is running 🚀"
  });
});


// ==========================================
// CURRENT STOCK PRICE
// ==========================================

app.get("/api/stock/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;

    const price = await getCurrentPrice(symbol);

    res.json({
      symbol,
      price
    });

  } catch (error) {
    console.error("Price error:", error.message);

    res.status(
      error.message.includes("API limit") ? 429 : 500
    ).json({
      message: error.message
    });
  }
});


// ==========================================
// HISTORICAL STOCK DATA
// ==========================================

app.get("/api/stock/:symbol/history", async (req, res) => {
  try {
    const { symbol } = req.params;

    const data = await getHistoricalData(symbol);

    res.json(data);

  } catch (error) {
    console.error("History error:", error.message);

    res.status(
      error.message.includes("API limit") ? 429 : 500
    ).json({
      message: error.message
    });
  }
});


// ==========================================
// TRADING STRATEGY
// EMA + RSI
// ==========================================

app.get("/api/strategy/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;

    // Use cached historical data
    const data = await getHistoricalData(symbol);

    // API data: newest -> oldest
    // Indicators ke liye oldest -> newest
    const values = data.values.slice().reverse();

    // Closing prices
    const closes = values.map(
      (item) => Number(item.close)
    );

    // EMA 9
    const ema9 = EMA.calculate({
      period: 9,
      values: closes
    });

    // EMA 21
    const ema21 = EMA.calculate({
      period: 21,
      values: closes
    });

    // RSI 14
    const rsi = RSI.calculate({
      period: 14,
      values: closes
    });

    const latestEMA9 = ema9[ema9.length - 1];
    const latestEMA21 = ema21[ema21.length - 1];
    const latestRSI = rsi[rsi.length - 1];

    const currentPrice = closes[closes.length - 1];

    // ======================================
    // BUY / SELL / HOLD
    // ======================================

    let signal = "HOLD";

    // BUY
    if (
      latestEMA9 > latestEMA21 &&
      latestRSI >= 50 &&
      latestRSI < 70
    ) {
      signal = "BUY";
    }

    // SELL
    else if (
      latestEMA9 < latestEMA21 &&
      latestRSI > 30 &&
      latestRSI <= 50
    ) {
      signal = "SELL";
    }

    res.json({
      symbol,
      currentPrice,

      ema9: Number(latestEMA9.toFixed(2)),
      ema21: Number(latestEMA21.toFixed(2)),
      rsi: Number(latestRSI.toFixed(2)),

      signal
    });

  } catch (error) {
    console.error("Strategy error:", error.message);

    res.status(
      error.message.includes("API limit") ? 429 : 500
    ).json({
      message: error.message
    });
  }
});


// ==========================================
// VIRTUAL BUY
// ==========================================

app.post("/api/trade/buy", async (req, res) => {
  try {
    const { symbol, quantity, price } = req.body;

    // Validation
    if (
      !symbol ||
      !Number.isFinite(Number(quantity)) ||
      Number(quantity) <= 0 ||
      !Number.isFinite(Number(price)) ||
      Number(price) <= 0
    ) {
      return res.status(400).json({
        message: "Valid symbol, quantity and price are required"
      });
    }

    const cleanQuantity = Number(quantity);
    const cleanPrice = Number(price);

    // Find portfolio
    let portfolio = await Portfolio.findOne();

    // First time portfolio doesn't exist
    if (!portfolio) {
      portfolio = await Portfolio.create({
        balance: 10000,
        holdings: {}
      });
    }

    const totalCost = cleanQuantity * cleanPrice;

    // Balance check
    if (totalCost > portfolio.balance) {
      return res.status(400).json({
        message: "Insufficient virtual balance"
      });
    }

    // Existing holding
    const holding = portfolio.holdings.get(symbol);

    if (holding) {
      const oldQuantity = holding.quantity;
      const oldValue =
        oldQuantity * holding.averagePrice;

      const newQuantity =
        oldQuantity + cleanQuantity;

      const newAveragePrice =
        (oldValue + totalCost) / newQuantity;

      portfolio.holdings.set(symbol, {
        quantity: newQuantity,
        averagePrice: newAveragePrice
      });

    } else {
      // First time buying this stock
      portfolio.holdings.set(symbol, {
        quantity: cleanQuantity,
        averagePrice: cleanPrice
      });
    }

    // Reduce balance
    portfolio.balance -= totalCost;

    await portfolio.save();

    // Save trade
    const trade = await Trade.create({
      type: "BUY",
      symbol,
      quantity: cleanQuantity,
      price: cleanPrice,
      totalValue: totalCost,
      profitLoss: 0
    });

    res.json({
      message: `Bought ${cleanQuantity} shares of ${symbol}`,
      trade,
      portfolio
    });

  } catch (error) {
    console.error("BUY error:", error.message);

    res.status(500).json({
      message: "BUY failed"
    });
  }
});


// ==========================================
// VIRTUAL SELL
// ==========================================

app.post("/api/trade/sell", async (req, res) => {
  try {
    const { symbol, quantity, price } = req.body;

    // Validation
    if (
      !symbol ||
      !Number.isFinite(Number(quantity)) ||
      Number(quantity) <= 0 ||
      !Number.isFinite(Number(price)) ||
      Number(price) <= 0
    ) {
      return res.status(400).json({
        message: "Valid symbol, quantity and price are required"
      });
    }

    const cleanQuantity = Number(quantity);
    const cleanPrice = Number(price);

    const portfolio = await Portfolio.findOne();

    if (!portfolio) {
      return res.status(400).json({
        message: "Portfolio not found"
      });
    }

    const holding = portfolio.holdings.get(symbol);

    // Stock ownership check
    if (!holding) {
      return res.status(400).json({
        message: `You don't own any ${symbol} shares`
      });
    }

    // Quantity check
    if (cleanQuantity > holding.quantity) {
      return res.status(400).json({
        message: "Not enough shares to sell"
      });
    }

    const totalSellValue =
      cleanQuantity * cleanPrice;

    // Calculate profit/loss
    const profitLoss =
      (cleanPrice - holding.averagePrice) *
      cleanQuantity;

    // Add money
    portfolio.balance += totalSellValue;

    // Remaining quantity
    const remainingQuantity =
      holding.quantity - cleanQuantity;

    if (remainingQuantity === 0) {
      portfolio.holdings.delete(symbol);
    } else {
      portfolio.holdings.set(symbol, {
        quantity: remainingQuantity,
        averagePrice: holding.averagePrice
      });
    }

    await portfolio.save();

    // Save SELL trade
    const trade = await Trade.create({
      type: "SELL",
      symbol,
      quantity: cleanQuantity,
      price: cleanPrice,
      totalValue: totalSellValue,
      profitLoss: Number(profitLoss.toFixed(2))
    });

    res.json({
      message: `Sold ${cleanQuantity} shares of ${symbol}`,
      trade,
      portfolio
    });

  } catch (error) {
    console.error("SELL error:", error.message);

    res.status(500).json({
      message: "SELL failed"
    });
  }
});


// ==========================================
// VIEW PORTFOLIO + P/L
// ==========================================

app.get("/api/portfolio", async (req, res) => {
  try {
    let portfolio = await Portfolio.findOne();

    // Create portfolio if it doesn't exist
    if (!portfolio) {
      portfolio = await Portfolio.create({
        balance: 10000,
        holdings: {}
      });
    }

    let currentValue = 0;
    let investedValue = 0;
    let holdings = [];

    // Check every holding
    for (const [symbol, holding] of portfolio.holdings.entries()) {

      // Use cached current price
      const currentPrice =
        await getCurrentPrice(symbol);

      const quantity = holding.quantity;
      const averagePrice = holding.averagePrice;

      const invested =
        quantity * averagePrice;

      const current =
        quantity * currentPrice;

      const profitLoss =
        current - invested;

      investedValue += invested;
      currentValue += current;

      holdings.push({
        symbol,
        quantity,
        averagePrice: Number(
          averagePrice.toFixed(2)
        ),
        currentPrice,
        investedValue: Number(
          invested.toFixed(2)
        ),
        currentValue: Number(
          current.toFixed(2)
        ),
        profitLoss: Number(
          profitLoss.toFixed(2)
        )
      });
    }

    const totalProfitLoss =
      currentValue - investedValue;

    res.json({
      balance: Number(
        portfolio.balance.toFixed(2)
      ),

      investedValue: Number(
        investedValue.toFixed(2)
      ),

      currentValue: Number(
        currentValue.toFixed(2)
      ),

      totalProfitLoss: Number(
        totalProfitLoss.toFixed(2)
      ),

      totalPortfolioValue: Number(
        (
          portfolio.balance +
          currentValue
        ).toFixed(2)
      ),

      holdings
    });

  } catch (error) {
    console.error(
      "Portfolio error:",
      error.message
    );

    res.status(
      error.message.includes("API limit") ? 429 : 500
    ).json({
      message: error.message
    });
  }
});


// ==========================================
// TRADE HISTORY
// ==========================================

app.get("/api/trades", async (req, res) => {
  try {
    const trades = await Trade.find()
      .sort({ createdAt: -1 });

    res.json({
      totalTrades: trades.length,
      trades
    });

  } catch (error) {
    console.error(
      "Trade history error:",
      error.message
    );

    res.status(500).json({
      message: "Failed to fetch trades"
    });
  }
});


// ==========================================
// START SERVER
// ==========================================

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {

    console.log(
      "MongoDB connected successfully"
    );

    app.listen(PORT, () => {
      console.log(
        `Server running on http://localhost:${PORT}`
      );
    });

  })
  .catch((error) => {

    console.error(
      "MongoDB connection failed:",
      error.message
    );

  });