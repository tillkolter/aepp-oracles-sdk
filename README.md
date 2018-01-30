# æpp oracles sdk

Javascript library with examples to integrate Æternity oracles. 

Read [this](https://github.com/aeternity/protocol/blob/master/epoch/api/oracle_api_usage.md) for an introduction to an oracle's lifecycle read 

## Installation 

*The implementation is early stage, so packaging configuration should not be seen as final.*

For development purposes the npm publishing configuration assembles only the browser compatible implementation. For the server side NodeJS integration please refer to the example section. 


```
npm install aepp-oracles-sdk
```

## Examples

An example server implementation can be found under [src/examples](https://github.com/tillkolter/aepp-oracles-sdk/tree/master/src/examples).

Client-side

```

import OracleConnection from 'aepp-oracles-sdk'

let connection = new OracleConnection(host, port, account)

connection.on('message', (message) => {
    console.log(`Websocket broadcasting: ${message}`)
}

...

connection.on('registeredOracle', (oracleId) => {
    connection.query(oracleId, 4, 5, 5, 7, 'What is the purpose of life?')
})

...

connection.on('response', (response) => {
    console.log(`Client's response: ${response}`)
    // "Client's response: 42"
})

```
