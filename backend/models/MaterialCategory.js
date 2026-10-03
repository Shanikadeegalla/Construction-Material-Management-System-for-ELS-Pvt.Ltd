import mongoose from 'mongoose';

// Categories added by the Admin on top of the built-in defaults in
// utils/materialCategories.js. The defaults are not stored here.
const materialCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  createdBy: {
    type: String,
    default: ''
  }
}, { timestamps: true });

export default mongoose.model('MaterialCategory', materialCategorySchema);
