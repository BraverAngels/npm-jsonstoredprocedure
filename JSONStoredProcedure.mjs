// JSONStoredProcedure.mjs -- implementation of executeJsonStoredProcedure for the Node.js environment.

// Uses the npm "mysql" interface as implemented by the mysql2 npm module.

import mysql from "mysql2/promise";

export {
  executeJsonStoredProcedure,
  executeJsonStoredProcedureUniqueResult
};

// Return an array of JSON objects from a MySQL stored procedure call.
// Requirement: the stored procedure returns a column named "JSON" or "Obj" (or the lowercase versions of these)
//    which contains JSON expressions for each result.
async function executeJsonStoredProcedure (storedProcedureCallSql, bindings,resultSetShouldBeReturned=true) {
  // console.log(`executeJsonStoredProcedure -- storedProcedureCallSql: ${storedProcedureCallSql}`);
  let dbConfig = { 
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_SOCKET_PATH
  };

  let conn;
  try {
      conn =
        await mysql.createConnection(dbConfig);

      // MySQL client: 
      //    {...} not needed for stored procedure execution
      //    prepare done internally as part of execution
      //    query is an operation on the connection, using SQL text and argument list parameters
    // conn.connect();
    let callParamValues =
      [];
    for (const binding of bindings) {
      if (!Array.isArray(binding)) {
        callParamValues.push(binding);
      } else if (binding.length == 3) {
        callParamValues.push(binding[2]);
        // console.log(`executeJsonStoredProcedure -- binding: ${binding[1]}("${binding[0]}",${binding[2]})`);
      } else { 
        throw new Error (`Each binding must have three elements: SQL parameter name, binding function, and value. "${binding} does not satisfy this constraint.`)
      }
    }
    // console.log(`executeJsonStoredProcedure -- parameters=${JSON.stringify(callParamValues)}`);

    const callParamValuesMappingUndefinedToNull =
      // Passing undefined causes an exception, so replace with null.
      callParamValues.map((x)=>x===null||x===undefined ? null : x);
    const [rows, fields] =
      await conn.execute(storedProcedureCallSql, callParamValuesMappingUndefinedToNull);
    const resultSet =
      rows[0];
    // console.log(`executeJsonStoredProcedure -- resultSet=
    // ${JSON.stringify(resultSet)}`);
    if (!resultSet) {
      // console.log(`executeJsonStoredProcedure -- 
      // rows=${JSON.stringify(rows)}, 
      // fields=${JSON.stringify(fields)}`);
          // Logging data for investigation.
      return;
    }
    const resultArray =
      resultSet
      ? resultSet.map((x)=>x.JSON||x.Obj||x.json||x.obj)
      : [];
      // resultSet will be undefined if the stored procedure does not create a result set
    return resultArray;
  } catch (err) {
    console.error (`executeJsonStoredProcedure -- failed to execute:
 ${storedProcedureCallSql}.
 Error:
 ${err.stack}`);
    throw err;
  }
  finally {
    if (conn) {
      conn.end();
    }
  }
}

// Return either a single JSON object or null from a MySQL stored procedure call.
// Throws an error if the result set contains more than one row.
async function executeJsonStoredProcedureUniqueResult (storedProcedureCallSql, evalWithStringBindings) {
  const resultObjectArray =
    await executeJsonStoredProcedure (storedProcedureCallSql, evalWithStringBindings);
  if (resultObjectArray.length == 0) {
    return null;
  } else if (resultObjectArray.length == 1) {
    return resultObjectArray[0];
  } else {
    throw (`executeJsonStoredProcedureUniqueResult -- Result set contains ${resultObjectArray.length} rows, but expected either 0 or 1`);
  }
}
