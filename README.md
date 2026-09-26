📈 Trading Bot

A virtual stock trading bot built using Node.js, Express, MongoDB, React and Twelve Data API.

⚠️ This is a virtual/paper trading project. No real money is involved.

🚀 Features
📊 Real-time & historical stock data
📈 EMA 9 & EMA 21
📊 RSI 14
🤖 BUY / SELL / HOLD strategy
💰 Virtual trading with ₹10,000
📦 Portfolio management
💹 Profit/Loss tracking
📜 Trade history
🗄️ MongoDB persistence
⚡ API caching
🔄 Auto refresh
📊 Stock price chart
🛠️ Tech Stack

Backend: Node.js, Express, MongoDB, Mongoose, Twelve Data, Axios

Frontend: React, Vite, Axios, Recharts, CSS

📊 Trading Strategy
BUY
EMA 9 > EMA 21
AND
RSI >= 50
AND
RSI < 70
SELL
EMA 9 < EMA 21
AND
RSI > 30
AND
RSI <= 50

Otherwise → HOLD

💰 Virtual Trading

Starting balance: ₹10,000

Users can virtually BUY and SELL stocks. Portfolio and trade history are stored in MongoDB.

⚡ API Caching
Current price: 30 seconds
Historical data: 5 minutes
Dashboard auto-refresh: 30 seconds
🔌 API Endpoints
GET  /api/stock/:symbol
GET  /api/stock/:symbol/history
GET  /api/strategy/:symbol
POST /api/trade/buy
POST /api/trade/sell
GET  /api/portfolio
GET  /api/trades
⚙️ Installation
cd backend
npm install
node server.js
cd frontend
npm install
npm run dev
🔑 Environment Variables
TWELVE_DATA_API_KEY=your_api_key_here
MONGO_URI=your_mongodb_connection_string

⚠️ Never upload .env to GitHub.

⚠️ Disclaimer

This project is for educational purposes and uses virtual/paper trading only.