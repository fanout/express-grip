const objectToString = Object.prototype.toString;
const stringObjectIdentifier = objectToString.call('');
export default function isString(obj: any): obj is string {
    return obj && objectToString.call(obj) === stringObjectIdentifier;
};
