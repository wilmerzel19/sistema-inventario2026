import * as XLSX from 'xlsx'

function saveWorkbook(rows, sheetName, filename, columns = []) {
  const ws = XLSX.utils.json_to_sheet(rows)
  if (columns.length) ws['!cols'] = columns.map(wch => ({ wch }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, filename, { compression: true })
}

export function exportProducts(products) {
  saveWorkbook(products.map(p => ({
    SKU: p.sku || '', Nombre: p.name || '', Categoria: p.category || '', Precio: Number(p.price || 0),
    Costo: Number(p.cost || 0), Stock: Number(p.stock || 0), StockMinimo: Number(p.minStock || 0),
    ImagenURL: p.imageUrl || '', Descripcion: p.description || '', Activo: p.active === false ? 'NO' : 'SI',
  })), 'Productos', 'inventario-productos.xlsx', [16,30,20,12,12,10,12,45,50,10])
}

export function exportDocuments(documents) {
  saveWorkbook(documents.map(d => ({
    Numero: d.number || '', Tipo: d.type === 'invoice' ? 'Factura' : 'Cotizacion', Cliente: d.customerName || 'Consumidor final',
    Telefono: d.customerPhone || '', Subtotal: Number(d.subtotal || 0), Impuesto: Number(d.tax || 0), Total: Number(d.total || 0),
    Fecha: d.createdAtText ? new Date(d.createdAtText).toLocaleString('es-NI') : '', Notas: d.notes || '',
  })), 'Documentos', 'facturas-cotizaciones.xlsx', [18,14,28,18,14,14,14,22,45])
}

export function exportCustomers(customers) {
  saveWorkbook(customers.map(c => ({
    Nombre: c.name || '', Telefono: c.phone || '', WhatsApp: c.whatsapp || '', Correo: c.email || '', Direccion: c.address || '', Notas: c.notes || '',
  })), 'Clientes', 'clientes.xlsx', [28,18,18,30,45,45])
}

export async function importProducts(file) {
  const data = await file.arrayBuffer()
  const wb = XLSX.read(data)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
  return rows.map(r => ({
    sku: String(r.SKU || r.sku || '').trim(), name: String(r.Nombre || r.name || '').trim(),
    category: String(r.Categoria || r.category || '').trim(), price: Number(r.Precio ?? r.price ?? 0),
    cost: Number(r.Costo ?? r.cost ?? 0), stock: Number(r.Stock ?? r.stock ?? 0), minStock: Number(r.StockMinimo ?? r.minStock ?? 0),
    imageUrl: String(r.ImagenURL || r.imageUrl || '').trim(), description: String(r.Descripcion || r.description || '').trim(),
    active: String(r.Activo || 'SI').toUpperCase() !== 'NO',
  })).filter(r => r.name)
}

export function exportSales(sales) {
  saveWorkbook(sales.map(s => ({
    Numero: s.number || '', Origen: s.source || '', Cliente: s.customerName || 'Consumidor final', Pago: s.paymentMethod || '',
    Subtotal: Number(s.subtotal || 0), Descuento: Number(s.discount || 0), Impuesto: Number(s.tax || 0), Total: Number(s.total || 0),
    CostoEstimado: Number(s.costTotal || 0), Fecha: s.createdAtText ? new Date(s.createdAtText).toLocaleString('es-NI') : '',
  })), 'Ventas', 'ventas.xlsx', [18,14,28,18,14,14,14,14,16,22])
}

export function exportPurchases(purchases) {
  saveWorkbook(purchases.map(p => ({
    Numero: p.number || '', Fecha: p.date || '', Proveedor: p.supplier || '', Referencia: p.reference || '', Pago: p.paymentMethod || '',
    Total: Number(p.total || 0), Notas: p.notes || '',
  })), 'Compras', 'compras.xlsx', [18,14,28,20,18,14,45])
}

export function exportExpenses(expenses) {
  saveWorkbook(expenses.map(e => ({
    Fecha: e.date || '', Concepto: e.title || '', Categoria: e.category || '', Pago: e.paymentMethod || '', Monto: Number(e.amount || 0), Notas: e.notes || '',
  })), 'Gastos', 'gastos.xlsx', [14,32,20,18,14,45])
}

export function exportInventoryMovements(movements) {
  saveWorkbook(movements.map(m => ({
    Fecha: m.date || (m.createdAtText ? new Date(m.createdAtText).toLocaleDateString('es-NI') : ''),
    Registrado: m.createdAtText ? new Date(m.createdAtText).toLocaleString('es-NI') : '',
    Producto: m.productName || '', SKU: m.sku || '', Tipo: m.type === 'entry' ? 'Entrada' : 'Salida',
    Origen: m.source || '', Motivo: m.reason || '', Referencia: m.reference || '', Cantidad: Number(m.quantity || 0),
    SaldoAntes: Number(m.balanceBefore || 0), SaldoDespues: Number(m.balanceAfter || 0), CostoUnitario: Number(m.unitCost || 0), Notas: m.notes || '',
  })), 'Movimientos', 'entradas-salidas-inventario.xlsx', [14,22,30,16,12,18,28,20,12,14,14,16,42])
}
