import { Request } from "express";

export default interface IGripExpressRequest extends Request {
    _body: boolean;
}