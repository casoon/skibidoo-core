// Integration Test Setup
// src/__tests__/integration/setup.ts

import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

let container: StartedPostgreSqlContainer;
let client: postgres.Sql;

export async function setupTestDatabase() {
  // Start PostgreSQL container
  container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("skibidoo_test")
    .withUsername("test")
    .withPassword("test")
    .start();

  const connectionString = container.getConnectionUri();

  // Create postgres client
  client = postgres(connectionString);

  // Create drizzle instance
  const db = drizzle(client);

  return {
    db,
    connectionString,
    container,
  };
}

export async function teardownTestDatabase() {
  if (client) {
    await client.end();
  }
  if (container) {
    await container.stop();
  }
}

export async function runMigrations(connectionString: string) {
  // In a real scenario, run drizzle migrations here
  // For now, create basic tables manually
  const sql = postgres(connectionString);

  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE NOT NULL,
      description TEXT,
      price DECIMAL(10,2) NOT NULL DEFAULT 0,
      compare_at_price DECIMAL(10,2),
      sku VARCHAR(100),
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE NOT NULL,
      description TEXT,
      parent_id UUID REFERENCES categories(id),
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS customers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_number VARCHAR(50) UNIQUE NOT NULL,
      customer_id UUID REFERENCES customers(id),
      status VARCHAR(50) DEFAULT 'pending',
      subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
      shipping DECIMAL(10,2) NOT NULL DEFAULT 0,
      tax DECIMAL(10,2) NOT NULL DEFAULT 0,
      total DECIMAL(10,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql.end();
}
