/* istanbul ignore file */
import { PORT } from '../config'
import app from './app'
import { getLogger } from './logger'

const logger = getLogger('server')

app.listen(PORT, () => {
    logger.info(`Server listening on port ${PORT}`)
})
