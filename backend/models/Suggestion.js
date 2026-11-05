const mongoose = require('mongoose');

const suggestionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['feature', 'bug', 'improvement', 'other'],
      default: 'feature',
    },
    status: {
      type: String,
      enum: ['submitted', 'in-review', 'planned', 'implemented', 'rejected'],
      default: 'submitted',
    },
    adminNotes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

suggestionSchema.index({ status: 1, createdAt: -1 });

const Suggestion = mongoose.model('Suggestion', suggestionSchema);
module.exports = Suggestion;
