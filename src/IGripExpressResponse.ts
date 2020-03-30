import { Response } from "express";
import IGripExpressResponseLocals from "./IGripExpressResponseLocals";

export default interface IGripExpressResponse extends Response {
    _headers: object;
    gripOriginalEnd: Function;
    locals: IGripExpressResponseLocals;
}
