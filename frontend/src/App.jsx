import { useEffect, useState } from "react";
import axios from "axios";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

import "./App.css";

const API = "";
const symbol = "AAPL";

// ==========================================
// DATE FORMATTER
// ==========================================

const formatChartDate = (date) => {
  const d = new Date(date);

  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short"
  });
};

function App() {
  const [strategy, setStrategy] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [trades, setTrades] = useState([]);
  const [history, setHistory] = useState([]);

  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  // ==========================================
  // LOAD DATA
  // ==========================================

  const loadData = async () => {
    try {
      const [
        strategyRes,
        portfolioRes,
        tradesRes,
        historyRes
      ] = await Promise.all([
        axios.get(`${API}/api/strategy/${symbol}`),
        axios.get(`${API}/api/portfolio`),
        axios.get(`${API}/api/trades`),
        axios.get(`${API}/api/stock/${symbol}/history`)
      ]);

      setStrategy(strategyRes.data);
      setPortfolio(portfolioRes.data);
      setTrades(tradesRes.data.trades);

      // ==========================================
      // PRICE CHART DATA
      // ==========================================

      const chartData = historyRes.data.values
        .slice()
        .reverse()
        .map((item) => ({
          date: item.datetime,
          price: Number(item.close)
        }));

      setHistory(chartData);
      setLastUpdated(new Date());

    } catch (error) {
      console.error("Failed to load data:", error);
    }
  };

  // ==========================================
  // BUY / SELL
  // ==========================================

  const handleTrade = async (type) => {
    try {
      setMessage("");

      if (!strategy) {
        setMessage("Strategy data is not available");
        return;
      }

      const price = Number(strategy.currentPrice);
      const tradeQuantity = Number(quantity);

      if (!tradeQuantity || tradeQuantity <= 0) {
        setMessage("Quantity must be greater than 0");
        return;
      }

      const response = await axios.post(
        `${API}/api/trade/${type}`,
        {
          symbol,
          quantity: tradeQuantity,
          price
        }
      );

      setMessage(response.data.message);

      await loadData();

    } catch (error) {
      setMessage(
        error.response?.data?.message || "Trade failed"
      );
    }
  };

  // ==========================================
  // INITIAL LOAD + AUTO REFRESH
  // ==========================================

  useEffect(() => {
    loadData();

    const interval = setInterval(() => {
      loadData();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // ==========================================
  // LOADING
  // ==========================================

  if (!strategy || !portfolio) {
    return <h2 className="loading">Loading Trading Bot...</h2>;
  }

  // ==========================================
  // UI
  // ==========================================

  return (
    <div className="app">

      <h1>📈 Trading Bot Dashboard</h1>

      {/* ======================================
          LAST UPDATED
      ====================================== */}

      {lastUpdated && (
        <p className="last-updated">
          Last Updated: {lastUpdated.toLocaleTimeString()}
        </p>
      )}

      {/* ======================================
          SUMMARY CARDS
      ====================================== */}

      <div className="cards">

        <div className="card">
          <h3>Virtual Balance</h3>
          <p>
            ${Number(portfolio.balance).toFixed(2)}
          </p>
        </div>

        <div className="card">
          <h3>Portfolio Value</h3>
          <p>
            ${Number(portfolio.totalPortfolioValue).toFixed(2)}
          </p>
        </div>

        <div className="card">
          <h3>Total P/L</h3>
          <p>
            ${Number(portfolio.totalProfitLoss).toFixed(2)}
          </p>
        </div>

      </div>

      {/* ======================================
          STRATEGY
      ====================================== */}

      <div className="section">

        <h2>{symbol} Strategy</h2>

        <div className="strategy">

          <div>
            <strong>Current Price</strong>
            <p>
              ${Number(strategy.currentPrice).toFixed(2)}
            </p>
          </div>

          <div>
            <strong>EMA 9</strong>
            <p>
              {Number(strategy.ema9).toFixed(2)}
            </p>
          </div>

          <div>
            <strong>EMA 21</strong>
            <p>
              {Number(strategy.ema21).toFixed(2)}
            </p>
          </div>

          <div>
            <strong>RSI</strong>
            <p>
              {Number(strategy.rsi).toFixed(2)}
            </p>
          </div>

          <div>
            <strong>Signal</strong>

            <p
              className={`signal ${strategy.signal.toLowerCase()}`}
            >
              {strategy.signal}
            </p>
          </div>

        </div>

        {/* ====================================
            BUY / SELL CONTROLS
        ==================================== */}

        <div className="trade-controls">

          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />

          <button
            className="buy-button"
            onClick={() => handleTrade("buy")}
          >
            BUY
          </button>

          <button
            className="sell-button"
            onClick={() => handleTrade("sell")}
          >
            SELL
          </button>

        </div>

        {/* ====================================
            TRADE ALERT
        ==================================== */}

        {message && (
          <div className="trade-alert">
            ✓ {message}
          </div>
        )}

      </div>

      {/* ======================================
          PRICE CHART
      ====================================== */}

      <div className="section">

        <h2>{symbol} Price Chart</h2>

        <div className="chart-container">

          <ResponsiveContainer width="100%" height="100%">

            <LineChart
              data={history}
              margin={{
                top: 10,
                right: 15,
                left: 5,
                bottom: 5
              }}
            >

              <CartesianGrid strokeDasharray="3 3" />

              <XAxis
                dataKey="date"
                tickFormatter={formatChartDate}
                tick={{ fontSize: 13 }}
                minTickGap={35}
              />

              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize: 13 }}
              />

              <Tooltip
                labelFormatter={(value) =>
                  new Date(value).toLocaleDateString(
                    "en-GB",
                    {
                      day: "2-digit",
                      month: "short",
                      year: "numeric"
                    }
                  )
                }
                formatter={(value) => [
                  `$${Number(value).toFixed(2)}`,
                  "Price"
                ]}
              />

              <Line
                type="monotone"
                dataKey="price"
                stroke="#2563eb"
                dot={false}
                strokeWidth={2}
              />

            </LineChart>

          </ResponsiveContainer>

        </div>

      </div>

      {/* ======================================
          HOLDINGS
      ====================================== */}

      <div className="section">

        <h2>Holdings</h2>

        {portfolio.holdings.length === 0 ? (

          <p>No holdings</p>

        ) : (

          <div className="holdings">

            {portfolio.holdings.map((holding) => (

              <div
                className="holding"
                key={holding.symbol}
              >

                <div className="holding-symbol">
                  {holding.symbol}
                </div>

                <div className="holding-info">

                  <div>
                    <span>Quantity</span>
                    <strong>
                      {holding.quantity}
                    </strong>
                  </div>

                  <div>
                    <span>Avg Price</span>
                    <strong>
                      ${Number(holding.averagePrice).toFixed(2)}
                    </strong>
                  </div>

                  <div>
                    <span>Current Price</span>
                    <strong>
                      $
                      {holding.symbol === symbol
                        ? Number(strategy.currentPrice).toFixed(2)
                        : Number(holding.currentPrice).toFixed(2)}
                    </strong>
                  </div>

                  <div>
                    <span>P/L</span>

                    <strong
                      className={
                        Number(holding.profitLoss) >= 0
                          ? "profit"
                          : "loss"
                      }
                    >
                      ${Number(holding.profitLoss).toFixed(2)}
                    </strong>
                  </div>

                </div>

              </div>

            ))}

          </div>

        )}

      </div>

      {/* ======================================
          TRADE HISTORY
      ====================================== */}

      <div className="section">

        <h2>Trade History</h2>

        {trades.length === 0 ? (

          <p>No trades yet</p>

        ) : (

          <div className="trade-history">

            {trades.map((trade) => (

              <div
                className="trade"
                key={trade._id}
              >

                <strong
                  className={
                    trade.type === "BUY"
                      ? "buy"
                      : "sell"
                  }
                >
                  {trade.type}
                </strong>

                <span>
                  {trade.symbol}
                </span>

                <span>
                  {trade.quantity} × $
                  {Number(trade.price).toFixed(2)}
                </span>

                <span>
                  P/L: $
                  {Number(trade.profitLoss).toFixed(2)}
                </span>

              </div>

            ))}

          </div>

        )}

      </div>

      {/* ======================================
          REFRESH
      ====================================== */}

      <button
        className="refresh-button"
        onClick={loadData}
      >
        🔄 Refresh Data
      </button>

    </div>
  );
}

export default App;