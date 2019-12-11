"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/* istanbul ignore file */
const config_1 = require("../config");
const app_1 = __importDefault(require("./app"));
const logger_1 = require("./logger");
const logger = logger_1.getLogger('server');
app_1.default.listen(config_1.PORT, () => {
    logger.info(`Server listening on port ${config_1.PORT}`);
});
//# sourceMappingURL=server.js.map