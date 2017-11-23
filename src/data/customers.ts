import * as sqlite from 'sqlite';
import * as sqlite3 from 'sqlite3';
import { dbPath, getDb } from '../db/utils';

interface AllCustOptions {
  filter?: string;
}

export async function getAllCustomers(options: AllCustOptions = {}): Promise<Customer[]> {
  const db = await getDb('dev');
  return await db.all('SELECT * FROM Customer');
}

export async function getCustomer(id: string | number): Promise<Customer[]> {
  const db = await getDb('dev');
  return await db.get('SELECT * FROM Customer WHERE id = $1', id);
}
