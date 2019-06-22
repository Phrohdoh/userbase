import 'babel-polyfill'
import axios from 'axios'
import crypto from './Crypto'
import stateManager from './stateManager'
import { sizeOfDdbItems } from './utils'

const ONE_KB = 1024
const ONE_MB = 1024 * ONE_KB
const NINETY_PERCENT_OF_ONE_MB = .9 * ONE_MB

self.onmessage = async (e) => {
  const transactionLogResponse = await axios.get('/api/db/query/tx-log')
  const transactionLog = transactionLogResponse.data

  const sizeOfTransactionLog = sizeOfDdbItems(transactionLog)

  if (sizeOfTransactionLog > NINETY_PERCENT_OF_ONE_MB) {
    console.log('Flushing db state!')

    const keyString = e.data
    const key = await crypto.aesGcm.importKey(keyString)

    let dbState = await stateManager().getDbState(key)
    dbState = await stateManager().applyTransactionsToDbState(key, dbState, transactionLog)

    const sequenceNos = transactionLog.map(item => item['sequence-no'])

    const encryptedDbState = await crypto.aesGcm.encrypt(key, dbState)

    await axios({
      method: 'POST',
      url: '/api/db/flush-db-state',
      params: {
        sequenceNos
      },
      data: encryptedDbState
    })
  }
}
