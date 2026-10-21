# Proyecto gRPC — Gestión de Almacén (Warehouse)

Implementación de una arquitectura cliente-servidor basada en **gRPC** con **Protocol Buffers (proto3)**.
El servidor está construido en **.NET 7 (C#)** con `Grpc.AspNetCore`; el cliente en **Node.js** con `@grpc/grpc-js`.

---

## Cumplimiento de Requerimientos

| Requerimiento | Estado | Detalle |
|---|:---:|---|
| Archivo `.proto` con servicio y mensajes | Cumple | `experimento.proto` define el servicio `Warehouse` y los mensajes `Product`, `ProductID`, `ProductName` y `ErrorResponse` |
| Servidor generado a partir del `.proto` | Cumple | `GrpcServer` (C# / `Grpc.AspNetCore`) compila el proto con `GrpcServices="Server"` e implementa la lógica en `WarehouseService.cs` |
| Cliente generado a partir del `.proto` | Cumple | `NodeClient` (Node.js / `@grpc/grpc-js`) carga el proto en tiempo de ejecución con `@grpc/proto-loader` |
| Llamada simple (unaria) | Cumple | `AddProduct`, `GetProductById` y `UpdateProduct` son RPCs unarios |
| Llamada con streaming continuo | Cumple | `GetProductByName` implementa **Server Streaming** (`returns (stream Product)`) |
| Compatibilidad con herramientas externas | Cumple | El servidor expone HTTP/2 en los puertos `5230` (HTTP) y `7019` (HTTPS), compatible con Postman y grpcurl |

---

## Estructura del Proyecto

```text
gRPC/
├── GrpcServer/                          # Servidor gRPC — .NET 7 / Grpc.AspNetCore
│   ├── Protos/
│   │   └── experimento.proto            # Contrato Protocol Buffers (fuente de verdad)
│   ├── Services/
│   │   └── WarehouseService.cs          # Implementación de los métodos RPC
│   ├── ErrorHandllingIterceptor.cs      # Interceptor global de manejo de errores
│   ├── Program.cs                       # Configuración de Kestrel y pipeline ASP.NET Core
│   └── appsettings.json                 # Puertos y protocolo HTTP/2
│
├── NodeClient/                          # Cliente gRPC — Node.js / @grpc/grpc-js
│   ├── protos/
│   │   └── experimento.proto            # Copia del contrato para carga en tiempo de ejecución
│   ├── warehouseClient.js               # Módulo cliente: stubs y métodos asíncronos con promesas
│   ├── client.js                        # Punto de entrada: suite de pruebas integradas
│   └── package.json                     # Dependencias npm
│
└── README.md
```

---

## Contrato Protocol Buffers (`experimento.proto`)

```protobuf
syntax = "proto3";

option csharp_namespace = "GrpcServer";

package warehouse;

// Definición del servicio Warehouse (Almacén).
service Warehouse {
  // Obtener un producto por su ID (llamada unaria simple)
  rpc GetProductById (ProductID) returns (Product){}

  // Buscar productos por nombre (llamada con streaming de servidor)
  rpc GetProductByName (ProductName) returns (stream Product){}

  // Agregar un nuevo producto (llamada unaria simple)
  rpc AddProduct (Product) returns (ProductID){}

  // Actualizar un producto existente (llamada unaria simple)
  rpc UpdateProduct (Product) returns (Product){}
}

// Representa un producto en el almacén.
message Product {
  string id = 1;
  string name = 2;
  int32 quantity = 3;
}

// Mensaje de solicitud con el ID del producto.
message ProductID { string id = 1; }

// Mensaje de solicitud con el nombre del producto para búsqueda.
message ProductName { string name = 1; }

// Detalles de error para respuestas estructuradas.
message ErrorResponse {
  string reason = 1;
  string details = 2;
}
```

---

## Requisitos Previos

**Servidor:**
- .NET 7.0 SDK o superior

**Cliente:**
- Node.js v18 o superior
- npm

---

## Configuración de Variables de Entorno (`.env`)

El proyecto utiliza variables de entorno para evitar datos fijos en el código. Se proporciona una plantilla `.example.env`:

```env
# Puerto HTTP/2 sin TLS (h2c) para el servidor .NET (usado por el cliente Node.js)
GRPC_HTTP_PORT=5230

# Puerto HTTP/2 con TLS para el servidor .NET (para Postman y grpcurl)
GRPC_HTTPS_PORT=7019

# Dirección completa del servidor a la que se conecta el cliente Node.js
GRPC_SERVER_ADDRESS=localhost:5230
```

---

## Instrucciones de Ejecución

### Paso 1 — Iniciar el Servidor gRPC

```powershell
cd GrpcServer
dotnet run
```

El servidor queda escuchando en:
- `http://localhost:5230` — HTTP/2 sin TLS (usado por el cliente Node.js)
- `https://localhost:7019` — HTTP/2 con TLS (para Postman y grpcurl)

### Paso 2 — Ejecutar el Cliente Node.js

Desde una segunda terminal:

```powershell
cd NodeClient
npm install    # solo la primera vez
node client.js
```

El cliente conecta al puerto `5230` (HTTP/2 sin TLS) usando `grpc.credentials.createInsecure()`.

---

## Salida Esperada del Cliente

```
Cliente gRPC conectado a localhost:5230

=======================================================
  1. AddProduct — Llamadas Unarias
=======================================================
Producto agregado — ID: 1, Nombre: Queso, Cantidad: 10
Producto agregado — ID: 2, Nombre: Papel, Cantidad: 20
Producto agregado — ID: 3, Nombre: Leche, Cantidad: 30
Error esperado al agregar 'Queso Duplicado': [6] El producto con ID '1' ya existe en el almacén.

=======================================================
  2. GetProductById — Llamada Unaria
=======================================================
Producto encontrado — ID: 2, Nombre: Papel, Cantidad: 20
Error al obtener ID '5': [5] No se encontró el producto con ID: 5

=======================================================
  3. UpdateProduct — Llamada Unaria
=======================================================
Producto actualizado — ID: 1, Nombre: Queso Gouda, Cantidad: 50

=======================================================
  4. GetProductByName — Server Streaming
=======================================================

Buscando productos con nombre: "Papel"
  [Stream] Recibido: Papel (Cantidad: 20)
Total recibidos via streaming: 1

Buscando productos con nombre: "NoExiste"
Error en streaming para 'NoExiste': [5] No se encontraron productos con el nombre: NoExiste

=======================================================
  Todas las pruebas finalizaron correctamente.
=======================================================
```

---

## Pruebas con Postman y grpcurl

### Postman

1. Crear una nueva solicitud de tipo **gRPC**.
2. Dirección: `localhost:7019`.
3. En la pestaña **Service definition**, seleccionar **Import a .proto file** y cargar `GrpcServer/Protos/experimento.proto`.
4. Seleccionar el método y enviar el mensaje correspondiente:

| Metodo | JSON de prueba |
|---|---|
| `warehouse.Warehouse/GetProductById` | `{ "id": "1" }` |
| `warehouse.Warehouse/AddProduct` | `{ "id": "4", "name": "Arroz", "quantity": 100 }` |
| `warehouse.Warehouse/UpdateProduct` | `{ "id": "1", "name": "Queso Manchego", "quantity": 15 }` |
| `warehouse.Warehouse/GetProductByName` | `{ "name": "Papel" }` |

5. Hacer clic en **Invoke**. Para `GetProductByName` los mensajes llegan progresivamente en el panel de respuesta (stream).

> Para pruebas contra el puerto HTTPS (`7019`) es necesario desactivar la verificación SSL en Postman (**Settings > SSL certificate verification: OFF**) porque el certificado de desarrollo de .NET no está en el almacén de confianza del sistema.

### grpcurl

```powershell
# Listar metodos disponibles
grpcurl -plaintext -import-path GrpcServer/Protos -proto experimento.proto localhost:5230 list warehouse.Warehouse

# Llamada unaria: AddProduct
grpcurl -plaintext -import-path GrpcServer/Protos -proto experimento.proto `
  -d '{"id":"4","name":"Arroz","quantity":100}' `
  localhost:5230 warehouse.Warehouse/AddProduct

# Llamada unaria: GetProductById
grpcurl -plaintext -import-path GrpcServer/Protos -proto experimento.proto `
  -d '{"id":"4"}' `
  localhost:5230 warehouse.Warehouse/GetProductById

# Server streaming: GetProductByName
grpcurl -plaintext -import-path GrpcServer/Protos -proto experimento.proto `
  -d '{"name":"Arroz"}' `
  localhost:5230 warehouse.Warehouse/GetProductByName
```

> `grpcurl` no está incluido en el repositorio. Se puede descargar desde [https://github.com/fullstorydev/grpcurl/releases](https://github.com/fullstorydev/grpcurl/releases). Colocar el binario en el PATH del sistema o ejecutar desde la ruta donde se descargó.

---

## Decisiones Tecnicas

**Streaming de servidor (`IServerStreamWriter<Product>`):**
El método `GetProductByName` define `returns (stream Product)` en el proto. El servidor itera sobre los productos coincidentes y escribe cada uno con `await responseStream.WriteAsync(product)`. El cliente Node.js consume el stream suscribiéndose al evento `data` del objeto `AsyncServerStreamingCall` devuelto por `@grpc/grpc-js`.

**Protocolo de transporte en el cliente Node.js:**
`@grpc/grpc-js` no permite desactivar la verificación de certificados self-signed directamente en `createSsl`. Para evitar dependencia de la instalación manual del certificado de desarrollo de .NET en el almacén del sistema operativo, el cliente usa `grpc.credentials.createInsecure()` apuntando al puerto `5230` (HTTP/2 en texto plano, `Protocols: Http2` en `appsettings.json`). Esta configuración es exclusiva para desarrollo local; en producción se usaría TLS con un certificado válido.

**Interceptor de errores en el servidor:**
`ErrorHandlingInterceptor` implementa `UnaryServerHandler` para capturar excepciones no controladas y convertirlas en `RpcException` con código `Internal`, evitando que el stack trace interno llegue al cliente.
