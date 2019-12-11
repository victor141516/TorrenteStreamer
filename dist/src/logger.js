"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* istanbul ignore file */
const log4js_1 = __importDefault(require("log4js"));
const config_1 = require("../config");
function getLogger(category, level = config_1.LOG_LEVEL) {
    const logger = log4js_1.default.getLogger(category);
    logger.level = level;
    return logger;
}
exports.getLogger = getLogger;
//# sourceMappingURL=logger.js.map