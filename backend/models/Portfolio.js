const mongoose = require("mongoose");

const portfolioSchema = new mongoose.Schema(
  {
    balance: {
      type: Number,
      default: 10000
    },

    holdings: {
      type: Map,
      of: {
        quantity: {
          type: Number,
          default: 0
        },

        averagePrice: {
          type: Number,
          default: 0
        }
      },
      default: {}
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Portfolio", portfolioSchema);