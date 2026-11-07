import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterAll, expect, it } from 'vitest';
import { prisma } from '../../src/shared/infrastructure/prisma.js';

afterAll(() => prisma.$disconnect());

it('moves lead contacts into client records and removes the old columns', async () => {
  const schema = `migration_${randomUUID().replaceAll('-', '')}`;
  const sql = readFileSync(new URL('../../prisma/migrations/20261110120000_crm_companies_people/migration.sql', import.meta.url), 'utf8');
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
    await tx.$executeRawUnsafe('CREATE TABLE organization (id TEXT PRIMARY KEY)');
    await tx.$executeRawUnsafe('CREATE TABLE client (id TEXT PRIMARY KEY)');
    await tx.$executeRawUnsafe('CREATE TABLE project (id TEXT PRIMARY KEY, client_id TEXT NOT NULL)');
    await tx.$executeRawUnsafe(`CREATE TABLE lead (
      id TEXT PRIMARY KEY, org_id TEXT NOT NULL, project_id TEXT NOT NULL, name TEXT NOT NULL,
      phone TEXT, email TEXT, telegram TEXT, messenger TEXT, company TEXT, website TEXT,
      created_at TIMESTAMP(3) NOT NULL, stage TEXT NOT NULL
    )`);
    await tx.$executeRawUnsafe("INSERT INTO organization VALUES ('org')");
    await tx.$executeRawUnsafe("INSERT INTO client VALUES ('client-a'), ('client-b')");
    await tx.$executeRawUnsafe("INSERT INTO project VALUES ('board-a', 'client-a'), ('board-b', 'client-b')");
    await tx.$executeRawUnsafe(`INSERT INTO lead VALUES
      ('anna-old','org','board-a','Anna','+375 (29) 111-22-33','anna@example.com',NULL,NULL,' Romashka ', 'https://old.example.com','2026-01-01','NEW'),
      ('anna-new','org','board-a','Anna New','+375291234567','Anna@Example.com','@anna',NULL,'romashka','https://new.example.com','2026-01-02','PROPOSAL'),
      ('phone-old','org','board-a','Phone Old','+375 (29) 777-77-77',NULL,NULL,NULL,NULL,NULL,'2026-01-01','NEW'),
      ('phone-new','org','board-a','Phone New','375297777777',NULL,NULL,NULL,NULL,NULL,'2026-01-02','NEW'),
      ('host','org','board-a','Host',NULL,NULL,NULL,NULL,NULL,'https://www.flowers.by/contact','2026-01-03','NEW'),
      ('other','org','board-b','Other','+375291234567','anna@example.com',NULL,NULL,'Romashka',NULL,'2026-01-04','NEW')`);
    for (const statement of sql.split(';').map((part) => part.replace(/^--.*$/gm, '').trim()).filter(Boolean)) {
      await tx.$executeRawUnsafe(statement);
    }
    const leads = await tx.$queryRawUnsafe<Array<{ id: string; person_id: string; company_id: string | null; stage: string }>>('SELECT id, person_id, company_id, stage FROM lead ORDER BY id');
    const byId = Object.fromEntries(leads.map((lead) => [lead.id, lead]));
    expect(byId['anna-old'].person_id).toBe(byId['anna-new'].person_id);
    expect(byId['phone-old'].person_id).toBe(byId['phone-new'].person_id);
    expect(byId['other'].person_id).not.toBe(byId['anna-new'].person_id);
    expect(byId['anna-old'].company_id).toBe(byId['anna-new'].company_id);
    expect(byId['other'].company_id).not.toBe(byId['anna-new'].company_id);
    expect(byId['anna-new'].stage).toBe('PROPOSAL');
    const people = await tx.$queryRawUnsafe<Array<{ name: string; phone: string | null; email: string | null; company_id: string | null }>>('SELECT name, phone, email, company_id FROM crm_person ORDER BY name');
    expect(people.find((person) => person.name === 'Anna New')).toMatchObject({ phone: '+375291234567', email: 'Anna@Example.com', company_id: byId['anna-new'].company_id });
    expect(people.find((person) => person.name === 'Phone New')?.phone).toBe('375297777777');
    const [digitsColumn] = await tx.$queryRawUnsafe<Array<{ is_generated: string }>>(`SELECT is_generated FROM information_schema.columns WHERE table_schema = '${schema}' AND table_name = 'crm_person' AND column_name = 'phone_digits'`);
    expect(digitsColumn.is_generated).toBe('ALWAYS');
    await tx.$executeRawUnsafe("UPDATE crm_person SET phone = '+375 (29) 555-55-55' WHERE name = 'Phone New'");
    const [updatedPhone] = await tx.$queryRawUnsafe<Array<{ phone_digits: string }>>("SELECT phone_digits FROM crm_person WHERE name = 'Phone New'");
    expect(updatedPhone.phone_digits).toBe('375295555555');
    const companies = await tx.$queryRawUnsafe<Array<{ name: string; website: string | null }>>('SELECT name, website FROM crm_company ORDER BY name');
    expect(companies).toContainEqual({ name: 'romashka', website: 'https://new.example.com' });
    expect(companies).toContainEqual({ name: 'flowers.by', website: 'https://www.flowers.by/contact' });
    const columns = await tx.$queryRawUnsafe<Array<{ column_name: string }>>(`SELECT column_name FROM information_schema.columns WHERE table_schema = '${schema}' AND table_name = 'lead'`);
    expect(columns.map((column) => column.column_name)).not.toEqual(expect.arrayContaining(['phone', 'email', 'company', 'website', 'telegram', 'messenger']));
    await tx.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  });
});
