import { assert } from 'chai';
import { suite, test } from 'mocha-typescript';

import {
  createOrder,
  getOrderDetails
} from '../src/data/orders';

import { VALID_ORDER_DATA } from './ex06.create-order.test';
import './helpers/global-hooks';

@suite('EX07: "Create an Order with OrderDetail items" - Transaction test')
class CreateOrderWithDetailsTest {
  @test('createOrder() completes without throwing an error')
  public async createOrderForValidData() {
    let { id } = await createOrder(VALID_ORDER_DATA, [
      { productid: 1, quantity: 3, discount: 0, unitprice: 3.0 }
    ]);
    if (typeof id === 'undefined') {
      throw new Error('createOrder() should return an object with an id');
    }
    assert.ok(id, 'createOrder() returns an object with an id');
  }

  @test('createOrder() results in the order details being created')
  public async createOrderAddsRecords() {
    let { id } = await createOrder(VALID_ORDER_DATA, [
      { productid: 1, quantity: 3, discount: 0, unitprice: 3.0 }
    ]);
    if (typeof id === 'undefined') {
      assert.ok(false, 'newly created order id is not truthy');
      return;
    }
    let orderDetails = await getOrderDetails(id);
    assert.equal(
      orderDetails.length,
      1,
      'Total number of Orders increases as a result of creating an order'
    );
  }
}
