import { loadConfig, saveGlobalConfig } from '@cod/config';

export async function configGet(key: string): Promise<void> {
  const settings = await loadConfig();
  const keys = key.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = settings;
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k];
    } else {
      console.error(`Key not found: ${key}`);
      process.exit(1);
    }
  }
  console.log(typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value));
}

export async function configSet(key: string, value: string): Promise<void> {
  const keys = key.split('.');
  // Build nested object
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj: any = {};
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    current[keys[i]] = {};
    current = current[keys[i]];
  }
  // Parse value
  let parsedValue: unknown = value;
  if (value === 'true') parsedValue = true;
  else if (value === 'false') parsedValue = false;
  else if (!isNaN(Number(value)) && value !== '') parsedValue = Number(value);

  current[keys[keys.length - 1]] = parsedValue;

  await saveGlobalConfig(obj);
  console.log(`Set ${key} = ${value}`);
}
