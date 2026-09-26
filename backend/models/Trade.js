const mongoose = require("mongoose");

const tradeSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["BUY", "SELL"],
      required: true
    },

    symbol: {
      type: String,
      required: true
    },

    quantity: {
      type: Number,
      required: true
    },

    price: {
      type: Number,
      required: true
    },

    totalValue: {
      type: Number,
      required: true
    },

    profitLoss: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Trade", tradeSchema);