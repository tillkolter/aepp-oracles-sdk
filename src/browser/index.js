
const events = require ('events')
const axios = require ('axios')

class OracleConnection {
  constructor(host, port, account, options) {
    this.account = account
    this.host = host
    this.port = port
    this.httpPort = options && options.httpPort || 3123
    this.em = new events.EventEmitter ()
    this.webSocket = new WebSocket (`ws://${host}:${port}/websocket`)

    this.webSocket.onopen = function (event) {
      this.em.emit ('open')
    }.bind (this)

    let blockHeightInterval;

    this.webSocket.onmessage = function (message) {
      let data = message.data
      let dataJson = JSON.parse (data)
      this.em.emit('message', data)
      let origin = dataJson.origin
      let action = dataJson.action
      if (origin === 'oracle') {
        if (action === 'register') {
          if (blockHeightInterval) {
            clearInterval(blockHeightInterval)
          }
          this.getBlockHeight().then(
            (startHeight) => {
              this.em.emit('newBlock', startHeight)
              let lastHeight = startHeight
              blockHeightInterval = setInterval(function () {
                this.getBlockHeight().then(
                  function(height) {
                    if (height > lastHeight) {
                      this.em.emit('newBlock', height)
                      if (this.oracle.status !== 'approved') {
                        this.em.emit('registeredOracle', this.oracle.id);
                        this.oracle.status = 'approved';
                      }
                      lastHeight = height
                    }
                  }.bind(this)
                )
              }.bind(this), 1000);
            }
          );

          const oracleId = dataJson.payload['oracle_id']
          this.oracle = {
            id: oracleId,
            status: 'pending'
          }
        } else if (action === 'query') {
          this.em.emit ('query', dataJson.payload['query_id'])
        } else if (action === 'subscribe') {
          this.em.emit ('subscribed', dataJson.payload['subscribed_to'])
        }
      } else if (origin === 'node') {
        if (action === 'new_oracle_query') {
          this.em.emit ('newQuery', dataJson.payload)
        } else if (action === 'new_oracle_response') {
          this.em.emit ('response', dataJson.payload)
        }
      }
    }.bind (this)
    this.webSocket.onclose = function () {
      this.em.emit('close')
    }.bind(this)
  }



  /**
   * Registers an oracle on the blockchain
   *
   * @param queryFormat format of the input
   * @param responseFormat format of the response
   * @param queryFee regular costs to post a query
   * @param ttl relative number of blocks before a query is dropped
   * @param fee the fee to register the oracle
   */
  register(queryFormat, responseFormat, queryFee, ttl, fee) {
    let data = {
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
    }
    this.webSocket.send (JSON.stringify (data), function ack(error) {
      if (error) {
        console.error (error)
      }
    }.bind (this))
    return data
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
    return data
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
        'query': typeof query.toString !== 'undefined' ? query.toString(): query
      }
    }
    this.webSocket.send (JSON.stringify (data))
    return data
  }

  /**
   * Subscribe to the event when the query gets answered
   *
   * @param queryId
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
    return data
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
    return data
  }

  on(message, callback) {
    this.em.on (message, callback)
  }

  async getBlockHeight() {
    const result = await axios.get(`http://${this.host}:${this.httpPort}/v2/top`)
    return result.data.height
  }
  //
  // getReadyState() {
  //   if (this.webSocket) {
  //     return this.webSocket.readyState
  //   }
  // }

}

module.exports = OracleConnection
