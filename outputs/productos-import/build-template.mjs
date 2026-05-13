import fs from 'node:fs/promises'
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool'

const outputDir = 'outputs/productos-import'
const publicDir = 'public/templates'
const outputFile = `${outputDir}/productos-carga-inicial.xlsx`
const publicFile = `${publicDir}/productos-carga-inicial.xlsx`

const workbook = Workbook.create()
const products = workbook.worksheets.add('Productos')
const instructions = workbook.worksheets.add('Instrucciones')

products.showGridLines = false
instructions.showGridLines = false

const headers = [
  'codigo',
  'nombre',
  'familia',
  'color',
  'unidad_medida',
  'cantidad_unidad',
  'stock_minimo',
  'stock_actual',
  'precio_referencia',
]

const examples = [
  ['ALU-SGU7', 'Super Gutter 7"', 'Aluminio Estructural', 'Bronce', 'pza', "36'", 2, 0, 0],
  ['TOR-SMS10', 'Screw SMS 10x2"', 'Tornilleria', 'Zinc', 'pza', '10x2"', 500, 0, 0],
  ['SEL-CAU', 'Caulking', 'Sellantes', 'Blanco', 'tbo', '1', 2, 0, 0],
]

products.getRange('A1:I1').values = [headers]
products.getRange('A2:I205').values = Array.from({ length: 204 }, () => Array(headers.length).fill(null))

products.getRange('A1:I1').format = {
  fill: '#0F766E',
  font: { bold: true, color: '#FFFFFF' },
  horizontalAlignment: 'center',
  verticalAlignment: 'center',
}
products.getRange('A1:I205').format.wrapText = true
products.getRange('A1:I205').format.verticalAlignment = 'center'
products.getRange('A2:I205').format = {
  fill: '#FFFFFF',
  font: { color: '#111827' },
}
products.getRange('A2:F205').format.numberFormat = '@'
products.getRange('G2:H205').format.numberFormat = '0'
products.getRange('I2:I205').format.numberFormat = '$#,##0.00'
products.getRange('A1:A205').format.columnWidth = 16
products.getRange('B1:B205').format.columnWidth = 34
products.getRange('C1:C205').format.columnWidth = 24
products.getRange('D1:D205').format.columnWidth = 16
products.getRange('E1:E205').format.columnWidth = 16
products.getRange('F1:F205').format.columnWidth = 18
products.getRange('G1:I205').format.columnWidth = 17
products.freezePanes.freezeRows(1)

const table = products.tables.add('A1:I205', true, 'ProductosCargaInicial')
table.style = 'TableStyleMedium2'
table.showFilterButton = true

products.getRange('E2:E205').dataValidation = {
  rule: {
    type: 'list',
    values: ['unidad', 'pza', 'kit', 'tbo', 'gal', 'lta', 'metro', 'barra', 'plancha', 'saco'],
  },
}

instructions.getRange('A1:F1').merge()
instructions.getRange('A1').values = [['Plantilla de carga inicial de productos']]
instructions.getRange('A1').format = {
  fill: '#0F766E',
  font: { bold: true, color: '#FFFFFF', size: 16 },
  horizontalAlignment: 'center',
  verticalAlignment: 'center',
}
instructions.getRange('A3:F3').merge()
instructions.getRange('A3').values = [['Complete la hoja Productos y suba este archivo desde Configuracion > Carga Inicial de Productos.']]
instructions.getRange('A3').format = { font: { color: '#374151' }, wrapText: true }

instructions.getRange('A5:C14').values = [
  ['Campo', 'Requerido', 'Descripcion'],
  ['codigo', 'Si', 'Codigo unico del producto. Si ya existe, se actualiza.'],
  ['nombre', 'Si', 'Nombre o descripcion del producto.'],
  ['familia', 'No', 'Categoria o familia para filtros y reportes.'],
  ['color', 'No', 'Color o acabado del producto.'],
  ['unidad_medida', 'No', 'Unidad base: unidad, pza, kit, tbo, gal, metro, etc.'],
  ['cantidad_unidad', 'No', 'Presentacion o medida: 36\', 10x2", 1, 6m, etc.'],
  ['stock_minimo', 'No', 'Cantidad minima para alertas de bajo stock.'],
  ['stock_actual', 'No', 'Inventario inicial general. Si queda vacio se toma como 0.'],
  ['precio_referencia', 'No', 'Costo o precio de referencia para reportes.'],
]
instructions.getRange('A5:C5').format = {
  fill: '#111827',
  font: { bold: true, color: '#FFFFFF' },
  horizontalAlignment: 'center',
}
instructions.getRange('A6:C14').format.wrapText = true
instructions.getRange('A1:A14').format.columnWidth = 22
instructions.getRange('B1:B14').format.columnWidth = 14
instructions.getRange('C1:C14').format.columnWidth = 70
instructions.freezePanes.freezeRows(5)

const instructionTable = instructions.tables.add('A5:C14', true, 'CamposProductos')
instructionTable.style = 'TableStyleMedium4'
instructionTable.showFilterButton = false

instructions.getRange('A17:I17').values = [headers]
instructions.getRange('A18:I20').values = examples
instructions.getRange('A17:I17').format = {
  fill: '#0F766E',
  font: { bold: true, color: '#FFFFFF' },
  horizontalAlignment: 'center',
}
instructions.getRange('A18:I20').format.wrapText = true
instructions.getRange('A16:I16').merge()
instructions.getRange('A16').values = [['Ejemplo de llenado']]
instructions.getRange('A16').format = { font: { bold: true, color: '#111827' } }

const inspect = await workbook.inspect({
  kind: 'table',
  range: 'Productos!A1:I6',
  include: 'values',
  tableMaxRows: 6,
  tableMaxCols: 9,
})
console.log(inspect.ndjson)

const errors = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
  options: { useRegex: true, maxResults: 50 },
  summary: 'formula error scan',
})
console.log(errors.ndjson)

const preview = await workbook.render({
  sheetName: 'Productos',
  range: 'A1:I12',
  scale: 1,
  format: 'png',
})
await fs.mkdir(outputDir, { recursive: true })
const previewBytes = new Uint8Array(await preview.arrayBuffer())
await fs.writeFile(`${outputDir}/productos-carga-inicial-preview.png`, previewBytes)

const xlsx = await SpreadsheetFile.exportXlsx(workbook)
await fs.mkdir(publicDir, { recursive: true })
await xlsx.save(outputFile)
await xlsx.save(publicFile)
await fs.copyFile(
  'C:/Users/suppl/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/tmp/spreadsheets/productos-import/build-template.mjs',
  `${outputDir}/build-template.mjs`,
)

console.log(`Saved ${outputFile}`)
console.log(`Saved ${publicFile}`)
