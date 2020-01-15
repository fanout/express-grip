import { Buffer } from 'buffer';
import main, * as mainProps from './main.mjs';
export default main;

Object.assign(main, mainProps, { Buffer });
