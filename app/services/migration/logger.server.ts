import fs from 'fs';
import path from 'path';

export function logCreation(shop: string, entityType: string, endpoint: string, input: any, output: any) {
  try {
    let moduleName = "other";
    const typeLower = entityType.toLowerCase();
    if (typeLower.includes('product') || typeLower.includes('variant') || typeLower.includes('inventory')) moduleName = 'products';
    else if (typeLower.includes('customer')) moduleName = 'customers';
    else if (typeLower.includes('order')) moduleName = 'orders';
    else if (typeLower.includes('categor')) moduleName = 'categories';
    else if (typeLower.includes('coupon')) moduleName = 'coupons';

    const logPath = path.join(process.cwd(), `mycreation-${moduleName}.log`);
    let fullUrl = `https://${shop}/admin/api/2025-01${endpoint}`;
    if (shop === 'external') {
      fullUrl = endpoint;
    }
    
    const logEntry = `\n[${new Date().toISOString()}] - ${entityType.toUpperCase()} ==================\nURL: ${input ? 'POST' : 'GET'} ${fullUrl}\nINPUT: ${JSON.stringify(input, null, 2)}\nOUTPUT: ${JSON.stringify(output, null, 2)}\n==================================================\n`;
    fs.appendFileSync(logPath, logEntry);
  } catch (err) {
    console.error("Failed to write to mycreation.log", err);
  }
}
