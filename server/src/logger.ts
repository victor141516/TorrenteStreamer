/* istanbul ignore file */
import log4js from 'log4js'

import { LOG_LEVEL } from '../config'

export function getLogger(category: string, level: string = LOG_LEVEL) {
    const logger = log4js.getLogger(category)
    logger.level = level
    return logger
}
