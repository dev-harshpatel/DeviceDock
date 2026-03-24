/**
 * Schema Verification Script
 * This script verifies that the database schema matches the expected structure
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ExpectedTable {
  name: string;
  columns: {
    name: string;
    type: string;
    nullable?: boolean;
  }[];
}

const expectedSchema: ExpectedTable[] = [
  {
    name: 'inventory',
    columns: [
      { name: 'id', type: 'text' },
      { name: 'device_name', type: 'text' },
      { name: 'brand', type: 'text' },
      { name: 'grade', type: 'text' },
      { name: 'storage', type: 'text' },
      { name: 'quantity', type: 'integer' },
      { name: 'price_per_unit', type: 'numeric' },
      { name: 'last_updated', type: 'text' },
      { name: 'price_change', type: 'text', nullable: true },
      { name: 'created_at', type: 'timestamp' },
      { name: 'updated_at', type: 'timestamp' },
    ],
  },
  {
    name: 'orders',
    columns: [
      { name: 'id', type: 'text' },
      { name: 'user_id', type: 'text' },
      { name: 'username', type: 'text' },
      { name: 'items', type: 'jsonb' },
      { name: 'total_price', type: 'numeric' },
      { name: 'status', type: 'text' },
      { name: 'created_at', type: 'timestamp' },
      { name: 'updated_at', type: 'timestamp' },
    ],
  },
];

async function verifySchema() {
  console.log('🔍 Verifying database schema...\n');

  for (const table of expectedSchema) {
    console.log(`📋 Checking table: ${table.name}`);
    
    // Try to query the table
    const { data, error } = await supabase
      .from(table.name)
      .select('*')
      .limit(0);

    if (error) {
      if (error.code === '42P01') {
        console.error(`❌ Table '${table.name}' does not exist!`);
        console.log(`\n📝 SQL to create the table:\n`);
        generateCreateTableSQL(table);
      } else {
        console.error(`❌ Error accessing table '${table.name}':`, error.message);
      }
    } else {
      console.log(`✅ Table '${table.name}' exists`);
      
      // Try to get column information by attempting to select specific columns
      const testColumns = table.columns.map(col => col.name);
      const { error: columnError } = await supabase
        .from(table.name)
        .select(testColumns.join(', '))
        .limit(0);

      if (columnError) {
        console.error(`❌ Column mismatch in '${table.name}':`, columnError.message);
      } else {
        console.log(`✅ All expected columns exist in '${table.name}'`);
      }
    }
    console.log('');
  }

  console.log('✅ Schema verification complete!');
}

function generateCreateTableSQL(table: ExpectedTable) {
  const columns = table.columns.map(col => {
    let sql = `  "${col.name}" `;
    
    switch (col.type) {
      case 'text':
        sql += 'TEXT';
        break;
      case 'integer':
        sql += 'INTEGER';
        break;
      case 'numeric':
        sql += 'NUMERIC(10,2)';
        break;
      case 'timestamp':
        sql += 'TIMESTAMP(3)';
        break;
      case 'jsonb':
        sql += 'JSONB';
        break;
      default:
        sql += col.type.toUpperCase();
    }

    if (col.name === 'id') {
      sql += ' NOT NULL PRIMARY KEY';
    } else if (!col.nullable && col.name !== 'id') {
      sql += ' NOT NULL';
    }

    if (col.name === 'created_at') {
      sql += ' DEFAULT CURRENT_TIMESTAMP';
    }
    if (col.name === 'updated_at') {
      sql += ' NOT NULL';
    }

    return sql;
  }).join(',\n');

  console.log(`CREATE TABLE IF NOT EXISTS "${table.name}" (\n${columns}\n);\n`);
}

// Run verification
verifySchema().catch(console.error);
