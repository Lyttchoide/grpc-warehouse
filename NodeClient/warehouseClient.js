/**
 * warehouseClient.js
 *
 * Módulo cliente para el servicio gRPC Warehouse.
 * Encapsula todas las llamadas RPC (unarias y streaming de servidor)
 * exponiendo métodos asíncronos con promesas.
 */

import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { fileURLToPath } from "url";
import path from "path";

// Resolver la ruta al archivo .proto relativa a este módulo
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROTO_PATH = path.join(__dirname, "protos", "experimento.proto");

// Opciones de carga del contrato Protocol Buffers
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,     // Preserva el nombre de los campos tal como están en el .proto
  longs: String,      // Representa los enteros largos como strings
  enums: String,      // Representa los enums como strings
  defaults: true,     // Incluye campos con valores por defecto
  oneofs: true,       // Habilita el soporte para campos oneof
});

const warehouseProto = grpc.loadPackageDefinition(packageDefinition).warehouse;

/**
 * Crea y devuelve un stub (cliente gRPC) para el servicio Warehouse.
 * Utiliza credenciales SSL/TLS reales con verificación deshabilitada
 * para entornos de desarrollo con certificados autofirmados.
 *
 * @param {string} address - Dirección del servidor (ej: "localhost:7019")
 * @returns {object} Stub del cliente gRPC
 */
export function createClient(address) {
  // En desarrollo local contra el servidor .NET se utiliza el puerto HTTP/2 sin TLS
  // (puerto 5230 configurado en appsettings.json del servidor).
  // @grpc/grpc-js requiere credenciales inseguras para conexiones h2c (HTTP/2 Cleartext).
  const credentials = grpc.credentials.createInsecure();

  return new warehouseProto.Warehouse(address, credentials);
}

/**
 * Llamada RPC Unaria: Agrega un nuevo producto al almacén.
 * @param {object} client - Stub del cliente gRPC
 * @param {string} id - Identificador único del producto
 * @param {string} name - Nombre del producto
 * @param {number} quantity - Cantidad en almacén
 * @returns {Promise<string>} ID asignado al producto
 */
export function addProduct(client, id, name, quantity) {
  return new Promise((resolve, reject) => {
    client.AddProduct({ id, name, quantity }, (error, response) => {
      if (error) return reject(error);
      resolve(response.id);
    });
  });
}

/**
 * Llamada RPC Unaria: Obtiene un producto por su ID.
 * @param {object} client - Stub del cliente gRPC
 * @param {string} id - Identificador del producto a buscar
 * @returns {Promise<object>} Objeto Product con id, name y quantity
 */
export function getProductById(client, id) {
  return new Promise((resolve, reject) => {
    client.GetProductById({ id }, (error, response) => {
      if (error) return reject(error);
      resolve(response);
    });
  });
}

/**
 * Llamada RPC Unaria: Actualiza un producto existente.
 * @param {object} client - Stub del cliente gRPC
 * @param {string} id - Identificador del producto
 * @param {string} name - Nuevo nombre del producto
 * @param {number} quantity - Nueva cantidad
 * @returns {Promise<object>} Objeto Product actualizado
 */
export function updateProduct(client, id, name, quantity) {
  return new Promise((resolve, reject) => {
    client.UpdateProduct({ id, name, quantity }, (error, response) => {
      if (error) return reject(error);
      resolve(response);
    });
  });
}

/**
 * Llamada RPC con Streaming de Servidor: Busca productos por nombre.
 * El servidor transmite cada coincidencia como un mensaje independiente
 * a través del stream abierto hasta cerrar la conexión.
 *
 * @param {object} client - Stub del cliente gRPC
 * @param {string} name - Término de búsqueda (coincidencia parcial en el servidor)
 * @returns {Promise<Array<object>>} Lista de productos recibidos vía stream
 */
export function getProductByName(client, name) {
  return new Promise((resolve, reject) => {
    const products = [];
    // Inicia la llamada streaming y obtiene el stream de respuesta
    const call = client.GetProductByName({ name });

    // Evento emitido cada vez que el servidor envía un mensaje
    call.on("data", (product) => {
      console.log(`  [Stream] Recibido: ${product.name} (Cantidad: ${product.quantity})`);
      products.push(product);
    });

    // Evento emitido cuando el servidor cierra el stream
    call.on("end", () => {
      resolve(products);
    });

    // Evento emitido ante un error en la transmisión
    call.on("error", (error) => {
      reject(error);
    });
  });
}
