import { getDb } from '../db/utils';
import { sql } from '../sql-string';

export const ALL_ORDERS_COLUMNS = ['id', 'customerid', 'employeeid', 'shipcity', 'shipcountry', 'shippeddate'];
export const ORDER_COLUMNS = ['*'];

/**
 * @typedef OrderCollectionOptions
 * @property {number} page Page number (zero-indexed)
 * @property {number} perPage Results per page
 * @property {string} sort Property to sort by
 * @property {'asc'|'desc'} order Sort direction
 * @description Options that may be used to customize a query for a collection of CustomerOrder records
 */

/**
 * Defaults values to use when parts of OrderCollectionOptions are not provided
 * @type {Readonly<OrderCollectionOptions>}
 */
const DEFAULT_ORDER_COLLECTION_OPTIONS = Object.freeze(
  /** @type {OrderCollectionOptions}*/({
    order: 'asc',
    page: 1,
    perPage: 20,
    sort: 'id'
  })
);

/**
 * Retrieve a collection of "all orders" from the database.
 * NOTE: This table has tens of thousands of records, so we'll probably have to apply
 *    some strategy for viewing only a part of the collection at any given time
 * @param {Partial<OrderCollectionOptions>} opts Options for customizing the query
 * @returns {Promise<Order[]>} the orders
 */
export async function getAllOrders(opts = {}, whereClause) {
  /*
  getAllOrders({ sort: 'shippeddate', order: 'desc'});
  getAllOrders({ sort: 'customerid', order: 'asc' });
  getAllOrders({ page: 3, perPage: 25 });
  getCustomerOrders('ALFKI', { page: 5, perPage: 10 });
  */
  // Combine the options passed into the function with the defaults
  /** @type {OrderCollectionOptions} */
  let options = {
    ...DEFAULT_ORDER_COLLECTION_OPTIONS,
    ...opts
  };

  const db = await getDb();
  let sortClause = '';
  if (options.sort && options.order) {
    sortClause = `ORDER BY co.${options.sort} ${options.order.toUpperCase()}`;
  }

  let pageClause = '';
  if (options.page && options.perPage) {
    pageClause = `LIMIT ${options.perPage} OFFSET ${(options.page - 1) * options.perPage}`
  }
  return await db.all(sql`
SELECT ${ALL_ORDERS_COLUMNS.map(x => 'co.' + x).join(',')}, c.companyname AS customername, e.lastname AS employeename
FROM CustomerOrder AS co
LEFT JOIN Customer as c ON co.customerid = c.id 
LEFT JOIN Employee as e ON co.employeeid = e.id

${whereClause} ${sortClause} ${pageClause}
`);
}

/**
 * Retrieve a list of CustomerOrder records associated with a particular Customer
 * @param {string} customerId Customer id
 * @param {Partial<OrderCollectionOptions>} opts Options for customizing the query
 */
export async function getCustomerOrders(customerId, opts = {}) {
  // ! This is going to retrieve ALL ORDERS, not just the ones that belong to a particular customer. We'll need to fix this
  /** @type {OrderCollectionOptions} */
  let options = {
    ...{ page: 1, perPage: 20, sort: 'shippeddate', order: 'asc' },
    ...opts
  }
  return getAllOrders(options, `WHERE customerid = '${customerId}'`);
}

/**
 * Retrieve an individual CustomerOrder record by id
 * @param {string | number} id CustomerOrder id
 * @returns {Promise<Order>} the order
 */
export async function getOrder(id) {
  const db = await getDb();
  return await db.get(
    sql`
SELECT co.*,
  c.companyname AS customername, 
  e.lastname AS employeename, 
  sum(od.unitprice * od.quantity * (1 - od.discount)) AS subtotal
FROM CustomerOrder AS co
LEFT JOIN Customer as c ON co.customerid = c.id
LEFT JOIN Employee as e ON co.employeeid = e.id
LEFT JOIN OrderDetail as od ON od.orderid = co.id
WHERE co.id = $1
GROUP BY co.id, c.companyname, e.lastname
`,
    id
  );
}

/**
 * Get the OrderDetail records associated with a particular CustomerOrder record
 * @param {string | number} id CustomerOrder id
 * @returns {Promise<OrderDetail[]>} the order details
 */
export async function getOrderDetails(id) {
  const db = await getDb();
  return await db.all(
    sql`
SELECT *, od.unitprice * od.quantity as price, p.productname
FROM OrderDetail AS od
INNER JOIN Product AS p ON od.productid = p.id
WHERE od.orderid = $1`,
    id
  );
}

/**
 * Get a CustomerOrder record, and its associated OrderDetails records
 * @param {string | number} id CustomerOrder id
 * @returns {Promise<[Order, OrderDetail[]]>} the order and respective order details
 */
export async function getOrderWithDetails(id) {
  let order = await getOrder(id);
  let items = await getOrderDetails(id);
  return [order, items];
}

/**
 * Create a new CustomerOrder record
 * @param {Pick<Order, 'employeeid' | 'customerid' | 'shipcity' | 'shipaddress' | 'shipname' | 'shipvia' | 'shipregion' | 'shipcountry' | 'shippostalcode' | 'requireddate' | 'freight'>} order data for the new CustomerOrder
 * @param {Array<Pick<OrderDetail, 'productid' | 'quantity' | 'unitprice' | 'discount'>>} details data for any OrderDetail records to associate with this new CustomerOrder
 * @returns {Promise<{id: string}>} the newly created order
 */
export async function createOrder(order, details = []) {
  /*
   createOrder(
    {
     employeeid: 3,
     customerid: 'ALFKI',
     shipcity: 'Minneapolis, MN',
     shipaddress: '60 South 6th St Suite 3625',
     shipname: 'Frontend Masters',
     shipvia: 1,
     shipregion: 1,
     shipcountry: 'USA',
     shippostalcode: '455402',
     requireddate: '2018-03-22T23:38:08.410Z',
     freight: 2.17
    },
    [ { productid: 17, unitprice: 4.11, quantity: 4, discount: 0 },
      { productid: 11, unitprice: 3.37, quantity: 1, discount: 0.10 }]
  );
                              
  */
  const db = await getDb();
  let result = await db.run(
    sql`INSERT INTO CustomerOrder (
      employeeid, 
      customerid, 
      shipcity, 
      shipaddress, 
      shipname, 
      shipvia, 
      shipregion, 
      shipcountry, 
      shippostalcode, 
      requireddate, 
      freight) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    order.employeeid,
    order.customerid,
    order.shipcity,
    order.shipaddress,
    order.shipname,
    order.shipvia,
    order.shipregion,
    order.shipcountry,
    order.shippostalcode,
    order.requireddate,
    order.freight
    ,
  );

  if (!result || typeof result.lastID === 'undefined') {
    throw new Error('no entry created');
  }
  return { id: result.lastID };
}

/**
 * Delete a CustomerOrder from the database
 * @param {string | number} id CustomerOrder id
 * @returns {Promise<any>}
 */
export async function deleteOrder(id) {
  const db = await getDb();
  return await db.run(
    sql`DELETE FROM CustomerOrder WHERE id = $1`,
    id
  );
}

/**
 * Update a CustomerOrder, and its associated OrderDetail records
 * @param {string | number} id CustomerOrder id
 * @param {Pick<Order, 'employeeid' | 'customerid' | 'shipcity' | 'shipaddress' | 'shipname' | 'shipvia' | 'shipregion' | 'shipcountry' | 'shippostalcode' | 'requireddate' | 'freight'>} data data for the new CustomerOrder
 * @param {Array<Pick<OrderDetail, 'id' | 'productid' | 'quantity' | 'unitprice' | 'discount'>>} details data for any OrderDetail records to associate with this new CustomerOrder
 * @returns {Promise<Partial<Order>>} the order
 */
export async function updateOrder(id, data, details = []) {
  return Promise.reject('Orders#updateOrder() NOT YET IMPLEMENTED');
}
