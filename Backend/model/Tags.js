const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema({
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    normalizedName: { type: String, required: true },
    tagName: {
        type: String,
        required: true
    }
});
tagSchema.index({ ownerId: 1, normalizedName: 1 }, { unique: true, partialFilterExpression: { ownerId: { $type: 'objectId' }, normalizedName: { $type: 'string' } } });

module.exports = mongoose.model('Tag', tagSchema, 'tags');
