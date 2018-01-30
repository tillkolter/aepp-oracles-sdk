#!/usr/bin/env node
'use strict';

const OracleConnection = require('../index')
const program = require('commander')
const axios = require('axios')

let runOracleServer = (account, options) => {

  console.log(`${options.host} ${options.port} ${options.httpPort}`)

  const connection = new OracleConnection (options.host, options.port, account, options)

  connection.on ('open', function () {
      console.log ('Websocket connection is open')
      connection.register ('queryFormat', 'responseFormat', 4, 500, 5)
    }
  )
  connection.on ('registeredOracle', function (oracleId) {
      console.log (`Oracle id ${oracleId}`)
      connection.subscribe (oracleId)
      // connection.query (oracleId, 4, 10, 10, 7, 'How are you?')
    }
  )
  connection.on ('query', function (queryId) {
      console.log (`Query id ${queryId}`)
      connection.subscribeQuery (queryId)
    }
  )
  connection.on ('subscribed', function (queryId) {
      console.log (`Subscription event ${JSON.stringify (queryId)}`)
    }
  )

  connection.on ('newQuery', function (queryData) {
    console.log (`New query data`)
    console.log(`Received query ${queryData['query']}`)
    let statementId = queryData['query']
    axios.get(`https://vote.aepps.com/statements/${statementId}/json`).then((response) => {
      connection.respond (queryData['query_id'], 4, JSON.stringify(response.data))
    }).catch(
      (error) => {
        console.error(error)
      }
    )

  })

  connection.on ('response', function (response) {
    console.log(`CLIENT RESPONSE: ${response}`)
  })

}

program
  .version('0.0.1')
  .command('start <account>')
  .description('Starts an oracle server')
  .option('-p, --port [port]', 'Websocket port', 3103)
  .option('-h, --host [host]', 'Websocket host', 'localhost')
  .option('-wp, --http-port <httpPort>', 'Http Port', 3104)
  .action(runOracleServer)

program.parse(process.argv)

if (program.args.length === 0) program.help();
