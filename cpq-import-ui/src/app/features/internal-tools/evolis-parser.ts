import {
  EvolisConfiguredRowView,
  EvolisLineRowView,
  EvolisPresentation,
  EvolisTableView
} from '../../core/models/evolis.models';

const PRICE_SCALE = 10_000n;

interface MutableTable extends EvolisTableView {}

export function parseEvolisPresentation(content: string): EvolisPresentation {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const tables: MutableTable[] = [];
  let currentTable: MutableTable | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (!line || line === ';' || line.startsWith('#')) {
      continue;
    }

    if (line.toUpperCase().startsWith('TABLEAU ')) {
      currentTable = {
        title: line.slice('TABLEAU '.length).trim(),
        idPanier: '',
        date: '',
        lineRows: [],
        configuredRows: [],
        subtotal: '0.0000'
      };
      tables.push(currentTable);
      continue;
    }

    if (!currentTable) {
      continue;
    }

    if (!currentTable.idPanier) {
      currentTable.idPanier = line.trim();
      continue;
    }

    if (!currentTable.date) {
      currentTable.date = line.trim();
      continue;
    }

    if (line.startsWith('L,')) {
      const parsed = parseLineRow(line);
      if (parsed) {
        currentTable.lineRows.push(parsed);
      }
      continue;
    }

    if (line.startsWith('C,')) {
      const parsed = parseConfiguredRow(line);
      if (parsed) {
        currentTable.configuredRows.push(parsed);
      }
    }
  }

  const presentation = tables.map((table) => {
    const subtotal = table.configuredRows.reduce((sum, row) => sum + parsePriceToScaledInt(row.totalPrice), 0n);
    return {
      ...table,
      subtotal: formatScaledPrice(subtotal)
    };
  });

  const grandTotal = presentation.reduce((sum, table) => sum + parsePriceToScaledInt(table.subtotal), 0n);

  return {
    tables: presentation,
    grandTotal: formatScaledPrice(grandTotal)
  };
}

function parseLineRow(line: string): EvolisLineRowView | null {
  const parts = line.split(',', 3);
  if (parts.length < 3) {
    return null;
  }

  return {
    type: 'L',
    quantity: formatQuantity(parts[1]),
    genericPartNumber: parts[2].trim()
  };
}

function parseConfiguredRow(line: string): EvolisConfiguredRowView | null {
  const parts = line.split(',', 6);
  if (parts.length < 6) {
    return null;
  }

  const quantity = formatQuantity(parts[2]);
  const unitPrice = formatPrice(parts[5]);

  return {
    type: 'C',
    genericPartNumber: parts[1].trim(),
    quantity,
    description: parts[3].trim(),
    unitPrice,
    totalPrice: multiplyPrice(unitPrice, quantity)
  };
}

function formatQuantity(value: string): string {
  const normalized = value.trim().replace(/^0+(?=\d)/, '');
  return normalized.length > 0 ? normalized : '0';
}

function formatPrice(value: string): string {
  return formatScaledPrice(parsePriceToScaledInt(value));
}

function parsePriceToScaledInt(value: string): bigint {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) {
    return 0n;
  }

  const isNegative = normalized.startsWith('-');
  const unsigned = isNegative ? normalized.slice(1) : normalized;
  const [wholePart = '0', fractionPart = ''] = unsigned.split('.');
  const whole = BigInt(wholePart || '0') * PRICE_SCALE;
  const fraction = BigInt((fractionPart + '0000').slice(0, 4));
  const total = whole + fraction;

  return isNegative ? -total : total;
}

function formatScaledPrice(value: bigint): string {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  const whole = absolute / PRICE_SCALE;
  const fraction = (absolute % PRICE_SCALE).toString().padStart(4, '0');
  return `${sign}${whole.toString()}.${fraction}`;
}

function multiplyPrice(unitPrice: string, quantity: string): string {
  const priceScaled = parsePriceToScaledInt(unitPrice);
  const qty = BigInt(quantity || '0');
  return formatScaledPrice(priceScaled * qty);
}