/**
 * client.js
 *
 * Punto de entrada del cliente Node.js para el servicio gRPC Warehouse.
 * Ejecuta una suite de pruebas que cubre:
 *   1. Llamadas unarias: AddProduct, GetProductById, UpdateProduct
 *   2. Llamada con streaming de servidor: GetProductByName
 *
 * Requisito: El servidor GrpcServer debe estar activo en https://localhost:7019
 * antes de ejecutar este script.
 *
 * Ejecucion:
 *   node client.js
 */

import "dotenv/config";
import {
  createClient,
  addProduct,
  getProductById,
  updateProduct,
  getProductByName,
} from "./warehouseClient.js";

// Dirección del servidor gRPC obtenida de variable de entorno (.env) o valor por defecto
const SERVER_ADDRESS = process.env.GRPC_SERVER_ADDRESS;

/**
 * Función auxiliar para imprimir separadores de sección en la consola.
 * @param {string} title - Título de la sección
 */
function section(title) {
  console.log(`\n${"=".repeat(55)}`);
  console.log(`  ${title}`);
  console.log("=".repeat(55));
}

// -------------------------------------------------------
// Ejecución principal (IIFE asíncrona)
// -------------------------------------------------------
(async () => {
  // Crear stub del cliente apuntando al servidor gRPC
  const client = createClient(SERVER_ADDRESS);
  console.log(`Cliente gRPC conectado a ${SERVER_ADDRESS}`);

  // -------------------------------------------------------
  // 1. Llamadas Unarias: Agregar productos
  // -------------------------------------------------------
  section("1. AddProduct — Llamadas Unarias");

  const productos = [
    { id: "1", name: "Queso", quantity: 10 },
    { id: "2", name: "Papel", quantity: 20 },
    { id: "3", name: "Leche", quantity: 30 },
    { id: "1", name: "Queso Duplicado", quantity: 5 }, // Prueba de validación: ID duplicado
  ];

  for (const p of productos) {
    try {
      const assignedId = await addProduct(client, p.id, p.name, p.quantity);
      console.log(`Producto agregado — ID: ${assignedId}, Nombre: ${p.name}, Cantidad: ${p.quantity}`);
    } catch (err) {
      console.error(`Error esperado al agregar '${p.name}': [${err.code}] ${err.details}`);
    }
  }

  // -------------------------------------------------------
  // 2. Llamada Unaria: Obtener producto por ID
  // -------------------------------------------------------
  section("2. GetProductById — Llamada Unaria");

  const idsABuscar = ["2", "5"]; // ID 5 no existe — prueba de manejo de error

  for (const id of idsABuscar) {
    try {
      const product = await getProductById(client, id);
      console.log(`Producto encontrado — ID: ${product.id}, Nombre: ${product.name}, Cantidad: ${product.quantity}`);
    } catch (err) {
      console.error(`Error al obtener ID '${id}': [${err.code}] ${err.details}`);
    }
  }

  // -------------------------------------------------------
  // 3. Llamada Unaria: Actualizar producto
  // -------------------------------------------------------
  section("3. UpdateProduct — Llamada Unaria");

  try {
    const updated = await updateProduct(client, "1", "Queso Gouda", 50);
    console.log(`Producto actualizado — ID: ${updated.id}, Nombre: ${updated.name}, Cantidad: ${updated.quantity}`);
  } catch (err) {
    console.error(`Error al actualizar: [${err.code}] ${err.details}`);
  }

  // -------------------------------------------------------
  // 4. Streaming de Servidor: Buscar productos por nombre
  // -------------------------------------------------------
  section("4. GetProductByName — Server Streaming");

  const terminos = ["Papel", "NoExiste"]; // 'NoExiste' prueba el caso sin resultados

  for (const termino of terminos) {
    console.log(`\nBuscando productos con nombre: "${termino}"`);
    try {
      const resultados = await getProductByName(client, termino);
      console.log(`Total recibidos via streaming: ${resultados.length}`);
    } catch (err) {
      console.error(`Error en streaming para '${termino}': [${err.code}] ${err.details}`);
    }
  }

  // -------------------------------------------------------
  // Fin de las pruebas
  // -------------------------------------------------------
  console.log("\n" + "=".repeat(55));
  console.log("  Todas las pruebas finalizaron correctamente.");
  console.log("=".repeat(55) + "\n");
})();
