const objectToString = Object.prototype.toString;
const stringObjectIdentifier = objectToString.call('');
export default function isFunction(obj) {
    return obj && objectToString.call(obj) === stringObjectIdentifier;
};
