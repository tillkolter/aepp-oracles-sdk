const WebSocket = require ('ws')
const events = require ('events')
const axios = require ('axios')

class OracleConnection {
  constructor(host, port, account, options) {
    this.httpPort = options && options.httpPort || 3023
    this.port = options && options.port || 3013
    this.host = host
    this.account = account
    this.em = new events.EventEmitter ()

    console.log (`${this.host} ${this.port} ${this.httpPort}`)
    this.webSocket = new WebSocket (`ws://${host}:${port}/websocket`, {
      perMessageDeflate: false
    })

    this.webSocket.on ('open', function open() {
      this.em.emit ('open')
    }.bind (this))

    this.webSocket.on ('message', function incoming(data) {
      console.log (`===> DATA ${data}`)
      let dataJson = JSON.parse (data)
      let origin = dataJson.origin
      let action = dataJson.action
      if (action === 'mined_block') {
        // Go through pending statuses
        if (this.oracle && this.oracle.status === 'pending') {
          this.em.emit ('registeredOracle', this.oracle.id)
          this.oracle.status = 'approved'
        }
      } else if (origin === 'oracle') {
        if (action === 'register') {
          let oracleId = dataJson.payload['oracle_id']
          this.getBlockHeight ().then (
            (startHeight) => {
              var interval = setInterval (function () {
                this.getBlockHeight ().then (
                  function (height) {
                    console.log ('Checked block height ' + height + ' (started: ' + height)
                    if (height > startHeight) {
                      this.em.emit ('registeredOracle', oracleId)
                      clearInterval (interval)
                    }
                  }.bind (this)
                ).catch ((error) => console.error (error))
              }.bind (this), 1000)
            }
          ).catch ((error) => console.error (error))
        } else if (action === 'query') {
          this.em.emit ('query', dataJson.payload['query_id'])
        } else if (action === 'subscribe') {
          this.em.emit ('subscribed', dataJson.payload['subscribed_to'])
        }
      } else if (origin === 'node') {
        if (action === 'new_oracle_query') {
          this.em.emit ('newQuery', dataJson.payload)
        } else if (action === 'new_oracle_response') {
          this.em.emit ('response', dataJson.payload.response)
        }
      }
    }.bind (this))
  }

  /**
   * Registers an oracle on the blockchain
   *
   * @param queryFormat format of the input
   * @param responseFormat format of the response
   * @param queryFee regular costs to post a query
   * @param ttl relative number of blocks before a query is dropped
   * @param fee the fee to register the oracle
   * @param callback function that is called when the registration is successful
   */
  register(queryFormat, responseFormat, queryFee, ttl, fee, callback) {
    this.webSocket.send (JSON.stringify ({
      'target': 'oracle',
      'action': 'register',
      'payload': {
        'type': 'OracleRegisterTxObject',
        'vsn': 1,
        'account': this.account,
        'query_format': queryFormat,
        'response_format': responseFormat,
        'query_fee': queryFee,
        'ttl': {'type': 'delta', 'value': ttl},
        'fee': fee
      }
    }), function ack(error) {
      if (error) {
        console.error (error)
      } else {
        console.log ('register send successful')
      }
    }.bind (this))
    this.registerCallback = callback
  }


  /**
   * Subscribes to an oracle
   *
   * @param oracleId Identifies the oracle on the blockchain
   * @param callback function that is called when the subscription is successfull
   */
  subscribe(oracleId) {
    let data = {
      'target': 'oracle',
      'action': 'subscribe',
      'payload': {
        'type': 'query',
        'oracle_id': oracleId
      }
    }
    this.webSocket.send (JSON.stringify (data))
  }

  /**
   * Posts a query to an oracle
   *
   * @param oracleId
   * @param queryFee reward for the oracle to respond to the query
   * @param queryTtl relative number of blocks before the query dies
   * @param responseTtl relative number of blocks before the response dies
   * @param fee transaction fee
   * @param query the query
   * @param callback success callback
   */
  query(oracleId, queryFee, queryTtl, responseTtl, fee, query) {
    // if (this.oracle) {
    let data = {
      'target': 'oracle',
      'action': 'query',
      'payload': {
        'type': 'OracleQueryTxObject',
        'vsn': 1,
        'oracle_pubkey': oracleId,
        'query_fee': queryFee,
        'query_ttl': {'type': 'delta', 'value': queryTtl},
        'response_ttl': {'type': 'delta', 'value': responseTtl},
        'fee': fee,
        'query': query
      }
    }
    this.webSocket.send (JSON.stringify (data))
  }

  /**
   * Subscribe to the event when the query gets answered
   *
   * @param queryId
   * @param callback success callback
   */
  subscribeQuery(queryId) {
    let data = {
      'target': 'oracle',
      'action': 'subscribe',
      'payload': {
        'type': 'response',
        'query_id': queryId
      }
    }
    this.webSocket.send (JSON.stringify (data))
  }

  /**
   * Responds to a query
   *
   * @param queryId
   * @param fee a transction fee
   * @param response the response
   */
  respond(queryId, fee, response) {
    let data = {
      'target': 'oracle',
      'action': 'response',
      'payload': {
        'type': 'OracleResponseTxObject',
        'vsn': 1,
        'query_id': queryId,
        'fee': fee,
        'response': response
      }
    }
    this.webSocket.send (JSON.stringify (data))
  }

  on(message, callback) {
    this.em.on (message, callback)
  }

  async getBlockHeight() {
    const result = await axios.get (`http://${this.host}:${this.httpPort}/v2/top`)
    return result.data.height
  }

}

module.exports = OracleConnection
