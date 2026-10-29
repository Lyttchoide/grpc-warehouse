# Construcción de un Servicio gRPC con .NET y Node.js
## Guía práctica: desde cero con Protocol Buffers, Servidor en C# y Cliente en JavaScript

**Sistemas Distribuidos y Computación en la Nube**

---

## ¿Qué es gRPC?

**gRPC** (gRPC Remote Procedure Call) es un framework de código abierto desarrollado inicialmente por Google para conectar servicios entre sí a máxima velocidad.

En una API REST tradicional, el cliente envía peticiones HTTP/1.1 con texto JSON ("*dame `/productos/1`*"). En **gRPC**, la comunicación se siente como si llamaras a una **función o método local dentro de tu propio código**, aunque esa función se esté ejecutando en otro servidor o en otro lenguaje de programación:

```
[ Cliente Node.js ] ─── AddProduct(producto) ──(HTTP/2 + Protobuf)──> [ Servidor .NET ]
```

### ¿Por qué gRPC en lugar de REST?

| Característica | API REST tradicional | gRPC |
|---|---|---|
| **Protocolo de red** | HTTP/1.1 (generalmente) | **HTTP/2** (multiplexación, cabeceras comprimidas) |
| **Formato de datos** | JSON (texto plano, pesado de parsear) | **Protocol Buffers** (binario, ultracompacto) |
| **Contrato de API** | Opcional (OpenAPI / Swagger) | **Estricto y obligatorio** (archivo `.proto`) |
| **Tipado** | Débil / dinámico | **Fuerte** en tiempo de compilación |
| **Rendimiento** | Moderado | **Hasta 7x a 10x más rápido** que REST |
| **Streaming** | Difícil (requiere WebSockets o SSE) | **Nativo bidireccional** |

---

## Terminología esencial de gRPC

Antes de comenzar a programar, debes familiarizarte con estos conceptos:

1. **Protocol Buffers (`.proto`)**: Es el lenguaje neutral ideado por Google para definir el "contrato" de la API: qué métodos existen y qué estructura tienen los datos que viajan.
2. **Mensaje (`message`)**: El equivalente a un objeto, modelo o interfaz de datos. Cada campo tiene un tipo y una etiqueta numérica (`int32 quantity = 3;`).
3. **Servicio (`service`)**: El equivalente a un controlador o interfaz con los métodos remotos que el servidor expone.
4. **RPC (Remote Procedure Call)**: Cada una de las funciones definidas dentro de un servicio.
5. **Stub (Cliente)**: Objeto generado que imita los métodos del servidor en el lado del cliente. Tú ejecutas `client.GetProductById(...)` y el stub se encarga de empaquetar los datos y enviarlos por la red.
6. **Serialización binaria**: El proceso de convertir los objetos de tu lenguaje a bytes comprimidos antes de viajar por el cable.

### Los 4 tipos de métodos en gRPC

A diferencia de los 4 métodos HTTP (`GET`, `POST`, `PUT`, `DELETE`), en gRPC los métodos se clasifican por **cómo fluyen los datos**:

```
1. Unario (Simple):           Cliente [ ──Petición──> ] Servidor
                              Cliente [ <──Respuesta── ] Servidor

2. Server Streaming:          Cliente [ ──Petición──> ] Servidor
                              Cliente [ <──Stream 1──<──Stream 2──<──Stream 3── ] Servidor

3. Client Streaming:          Cliente [ ──Stream 1──>──Stream 2──> ] Servidor
                              Cliente [ <──Respuesta── ] Servidor

4. Streaming Bidireccional:   Cliente [ ──Stream──> ] Servidor
                              Cliente [ <──Stream── ] Servidor
```

*En este proyecto implementamos llamadas **Unarias** (CRUD básico) y **Server Streaming** (búsqueda de productos en tiempo real).*

---

## Códigos de estado en gRPC vs HTTP

En gRPC no existen códigos `200`, `404` ni `500`. En su lugar, se utilizan códigos de estado estándar de gRPC:

| Código gRPC | Número | Equivalente HTTP | Cuándo se usa |
|---|:---:|:---:|---|
| `OK` | 0 | `200 OK` | Operación completada con éxito |
| `InvalidArgument` | 3 | `400 Bad Request` | Faltan datos requeridos o son inválidos |
| `NotFound` | 5 | `404 Not Found` | El ID o recurso solicitado no existe |
| `AlreadyExists` | 6 | `409 Conflict` | Ya existe un registro con ese identificador |
| `Internal` | 13 | `500 Internal Error` | Ocurrió un error no controlado en el servidor |

---

## Requisitos previos y entorno en VS Code

### 1. Software necesario
- **.NET SDK 7.0 o superior** (verifica en la terminal con `dotnet --version`). 
- **Node.js v18 o superior** y **npm** (verifica con `node -v` y `npm -v`). 
- **Visual Studio Code**. 

### 2. Extensiones recomendadas en VS Code
Abre la pestaña de extensiones (`Ctrl+Shift+X` en Windows/Linux) e instala:
- **C# Dev Kit** o **C#** (Microsoft): Provee autocompletado, resaltado de sintaxis y depuración para .NET.
- **vscode-proto3** o **Protocol Buffers** (zxh404): Resaltado de sintaxis y formato para archivos `.proto`.
- **Postman** (o Postman de escritorio): Para interactuar visualmente con endpoints gRPC.

---

## Parte 1 — Crear la estructura del proyecto en VS Code

Abre una terminal integrada en Visual Studio Code (`Ctrl + ñ` o menú *Terminal > New Terminal*).

### 1.1 Crear la carpeta raíz del proyecto

```bash
mkdir gRPC
cd gRPC
```

### 1.2 Crear el proyecto del Servidor (.NET 7 Web/gRPC)

Crea el proyecto del servidor mediante la CLI de .NET:

```powershell
dotnet new web -n GrpcServer
```

Entra a la carpeta del servidor e instala los paquetes NuGet oficiales para soporte de gRPC y Reflection (necesario para herramientas como Postman):

```powershell
cd GrpcServer
dotnet add package Grpc.AspNetCore
dotnet add package Grpc.AspNetCore.Server.Reflection
cd ..
```

> **¿Qué es Grpc.AspNetCore?**
> Es el motor de gRPC para ASP.NET Core. Integra el compilador de `.proto` directamente en el comando `dotnet build` y optimiza Kestrel para servir HTTP/2 de alto rendimiento.

### 1.3 Inicializar el proyecto del Cliente (Node.js)

Desde la raíz `gRPC/`, crea la carpeta del cliente e instala sus dependencias:

```powershell
mkdir NodeClient
cd NodeClient
npm init -y
```

Modifica `NodeClient/package.json` para habilitar módulos ES (`"type": "module"`) y agrega las dependencias gRPC:

```powershell
npm install @grpc/grpc-js @grpc/proto-loader dotenv
cd ..
```

> **¿Para qué sirven estas dependencias?**
> - `@grpc/grpc-js`: La implementación pura en JavaScript del protocolo gRPC.
> - `@grpc/proto-loader`: Lee el archivo `.proto` en tiempo de ejecución sin necesidad de precompilar binarios.
> - `dotenv`: Carga variables de entorno para que los puertos no queden fijos en el código.

### 1.4 Crear el archivo de configuración `.env`

En la raíz del proyecto, crea un archivo `.env` para compartir la configuración entre el servidor y el cliente:

```env
# Puerto HTTP/2 sin TLS (h2c) para desarrollo local
GRPC_HTTP_PORT=5230

# Puerto HTTP/2 con TLS (para Postman y grpcurl)
GRPC_HTTPS_PORT=7019

# Dirección a la que conectará el cliente Node.js
GRPC_SERVER_ADDRESS=localhost:5230
```

### 1.5 Crear el `.gitignore`

Crea un archivo `.gitignore` en la raíz para evitar subir dependencias y archivos compilados:

```gitignore
# Node.js
node_modules/
npm-debug.log

# .NET / C#
bin/
obj/
*.user

# Entorno
.env
```

### 1.6 Estructura del proyecto resultante

Al terminar esta parte, tu espacio de trabajo en VS Code debe verse así:

```text
gRPC/
├── .env
├── .gitignore
├── GrpcServer/
│   ├── GrpcServer.csproj
│   ├── Program.cs
│   └── appsettings.json
└── NodeClient/
    ├── package.json
    └── node_modules/
```

---

## Parte 2 — El contrato: Protocol Buffers (`experimento.proto`)

En gRPC, **el contrato siempre se diseña primero** (Contract-First Design). Tanto el cliente como el servidor se basarán en este mismo archivo.

### 2.1 Crear el archivo `.proto`

Crea la carpeta `GrpcServer/Protos/` y dentro de ella el archivo `experimento.proto`:

```protobuf
syntax = "proto3";

option csharp_namespace = "GrpcServer";

package warehouse;

// Definición del servicio Warehouse (Almacén).
service Warehouse {
  // 1. Obtener un producto por su ID (Unario)
  rpc GetProductById (ProductID) returns (Product);

  // 2. Buscar productos por coincidencia de nombre (Server Streaming)
  rpc GetProductByName (ProductName) returns (stream Product);

  // 3. Agregar un nuevo producto (Unario)
  rpc AddProduct (Product) returns (ProductID);

  // 4. Actualizar un producto existente (Unario)
  rpc UpdateProduct (Product) returns (Product);
}

// Representa un producto en el almacén.
message Product {
  string id = 1;
  string name = 2;
  int32 quantity = 3;
}

// Solicitud que contiene solo el ID del producto
message ProductID {
  string id = 1;
}

// Solicitud que contiene el nombre para realizar búsquedas
message ProductName {
  string name = 1;
}

// Estructura para respuestas de error detalladas
message ErrorResponse {
  string reason = 1;
  string details = 2;
}
```

> **Reglas de sintaxis Protobuf:**
> - `syntax = "proto3";` define la versión 3 de Protocol Buffers.
> - Los números `= 1;`, `= 2;` **NO son valores iniciales ni índices de array**; son los identificadores de campo (tags binarios) que viajan en los paquetes de red. No deben cambiarse una vez definida la API.
> - La palabra reservada `stream` antes de `Product` en `returns (stream Product)` indica que el servidor no enviará una sola respuesta, sino un canal abierto de respuestas sucesivas.

### 2.2 Copiar el contrato al cliente Node.js

Copia el contrato para que el cliente pueda cargarlo en tiempo de ejecución:

```powershell
mkdir NodeClient\protos
copy GrpcServer\Protos\experimento.proto NodeClient\protos\
```

### 2.3 Vincular el `.proto` en el proyecto C# (`GrpcServer.csproj`)

Abre `GrpcServer/GrpcServer.csproj` y asegúrate de que el compilador de .NET sepa que debe generar código para este contrato:

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">

  <PropertyGroup>
    <TargetFramework>net7.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>

  <!-- Le indica al compilador de C# que genere la clase base del servidor -->
  <ItemGroup>
    <Protobuf Include="Protos\experimento.proto" GrpcServices="Server" />
  </ItemGroup>

  <ItemGroup>
    <PackageReference Include="Grpc.AspNetCore" Version="2.49.0" />
    <PackageReference Include="Grpc.AspNetCore.Server.Reflection" Version="2.49.0" />
  </ItemGroup>

</Project>
```

---

## Parte 3 — Implementar el Servidor en C# (.NET)

### 3.1 Configurar Kestrel y los puertos (`Program.cs`)

gRPC requiere el protocolo **HTTP/2**. En Windows y entornos locales, los certificados TLS autofirmados pueden generar problemas con clientes Node.js o Postman. Por ello, configuramos dos canales en Kestrel:
1. **Puerto 5230**: HTTP/2 en texto plano (`h2c`), ideal para el cliente Node.js.
2. **Puerto 7019**: HTTP/2 con TLS/HTTPS, ideal para Postman y grpcurl.

Reemplaza el contenido de `GrpcServer/Program.cs`:

```csharp
using GrpcServer.Services;
using Microsoft.AspNetCore.Server.Kestrel.Core;

var builder = WebApplication.CreateBuilder(args);

// Leer puertos desde variables de entorno o valores por defecto
var httpPort = 5230;
var httpsPort = 7019;

// Configuración explícita del servidor web Kestrel para HTTP/2
builder.WebHost.ConfigureKestrel(options =>
{
    // Puerto HTTP (sin TLS) para el cliente Node.js
    options.ListenLocalhost(httpPort, o =>
    {
        o.Protocols = HttpProtocols.Http2;
    });

    // Puerto HTTPS (con TLS) para Postman y herramientas externas
    options.ListenLocalhost(httpsPort, o =>
    {
        o.Protocols = HttpProtocols.Http2;
        o.UseHttps();
    });
});

// Registrar los servicios de gRPC y Reflection
builder.Services.AddGrpc();
builder.Services.AddGrpcReflection();

var app = builder.Build();

// Mapear la implementación de nuestro servicio gRPC
app.MapGrpcService<WarehouseService>();
app.MapGrpcReflectionService();

app.MapGet("/", () => "El servidor gRPC está activo. Conéctate usando un cliente gRPC.");

app.Run();
```

---

### 3.2 Implementar la lógica del servicio (`WarehouseService.cs`)

Crea la carpeta `GrpcServer/Services/` y dentro el archivo `WarehouseService.cs`. Esta clase heredará automáticamente de `Warehouse.WarehouseBase` (generada por .NET a partir del `.proto`):

```csharp
using Grpc.Core;

namespace GrpcServer.Services
{
    public class WarehouseService : Warehouse.WarehouseBase
    {
        // Colección en memoria que almacena los productos
        private static readonly Dictionary<string, Product> _products = new();

        // 1. RPC UNARIO: Obtener producto por ID
        public override Task<Product> GetProductById(ProductID request, ServerCallContext context)
        {
            if (_products.TryGetValue(request.Id, out Product? product) && product != null)
            {
                return Task.FromResult(product);
            }

            // Si no existe, lanzamos un error gRPC con código NotFound
            throw new RpcException(new Status(StatusCode.NotFound, $"No se encontró el producto con ID: {request.Id}"));
        }

        // 2. RPC SERVER STREAMING: Buscar productos y enviarlos como flujo continuo
        public override async Task GetProductByName(ProductName request, IServerStreamWriter<Product> responseStream, ServerCallContext context)
        {
            var matchingProducts = _products.Values
                .Where(p => p.Name.Contains(request.Name, StringComparison.OrdinalIgnoreCase))
                .ToList();

            if (matchingProducts.Count == 0)
            {
                throw new RpcException(new Status(StatusCode.NotFound, $"No se encontraron productos con el nombre: {request.Name}"));
            }

            // Transmitir cada coincidencia al cliente a través del canal abierto
            foreach (var product in matchingProducts)
            {
                await responseStream.WriteAsync(product);
                await Task.Delay(200); // Pequeña pausa para apreciar el streaming
            }
        }

        // 3. RPC UNARIO: Agregar un nuevo producto
        public override Task<ProductID> AddProduct(Product request, ServerCallContext context)
        {
            if (string.IsNullOrWhiteSpace(request.Id))
            {
                throw new RpcException(new Status(StatusCode.InvalidArgument, "El ID del producto no puede estar vacío."));
            }

            if (_products.ContainsKey(request.Id))
            {
                throw new RpcException(new Status(StatusCode.AlreadyExists, $"El producto con ID '{request.Id}' ya existe."));
            }

            _products[request.Id] = request;
            return Task.FromResult(new ProductID { Id = request.Id });
        }

        // 4. RPC UNARIO: Actualizar un producto existente
        public override Task<Product> UpdateProduct(Product request, ServerCallContext context)
        {
            if (string.IsNullOrWhiteSpace(request.Id))
            {
                throw new RpcException(new Status(StatusCode.InvalidArgument, "El ID del producto no puede estar vacío."));
            }

            if (_products.ContainsKey(request.Id))
            {
                _products[request.Id] = request;
                return Task.FromResult(request);
            }

            throw new RpcException(new Status(StatusCode.NotFound, $"No se encontró el producto con ID: {request.Id}"));
        }
    }
}
```

---

## Parte 4 — Implementar el Cliente en Node.js

En Node.js usaremos `@grpc/proto-loader` para cargar el archivo `.proto` de forma dinámica y envolveremos los callbacks tradicionales de Node.js en **Promesas** modernas (`async/await`).

### 4.1 Módulo del Cliente (`warehouseClient.js`)

Crea el archivo `NodeClient/warehouseClient.js`:

```javascript
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import { fileURLToPath } from "url";
import path from "path";

// Resolver la ruta hacia el archivo .proto
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROTO_PATH = path.join(__dirname, "protos", "experimento.proto");

// Cargar y compilar el contrato en memoria
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,     // Mantiene los nombres tal como se escribieron en el proto
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const warehouseProto = grpc.loadPackageDefinition(packageDefinition).warehouse;

/**
 * Crea el stub del cliente gRPC
 */
export function createClient(address) {
  // Para conexiones directas por HTTP/2 sin TLS usamos credenciales inseguras
  const credentials = grpc.credentials.createInsecure();
  return new warehouseProto.Warehouse(address, credentials);
}

/**
 * Llamada Unaria: Agregar producto
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
 * Llamada Unaria: Obtener producto por ID
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
 * Llamada Unaria: Actualizar producto
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
 * Llamada con Streaming de Servidor: Buscar productos por nombre
 */
export function getProductByName(client, name) {
  return new Promise((resolve, reject) => {
    const products = [];
    const call = client.GetProductByName({ name });

    // Se dispara cada vez que el servidor envía un mensaje del stream
    call.on("data", (product) => {
      console.log(`  [Stream] Recibido: ${product.name} (Stock: ${product.quantity})`);
      products.push(product);
    });

    // Se dispara cuando el servidor termina de enviar todos los mensajes
    call.on("end", () => {
      resolve(products);
    });

    // Se dispara si ocurre un error durante la transmisión
    call.on("error", (error) => {
      reject(error);
    });
  });
}
```

---

### 4.2 Script de pruebas e interacción (`client.js`)

Crea el archivo `NodeClient/client.js` para ejecutar las operaciones de prueba:

```javascript
import "dotenv/config";
import {
  createClient,
  addProduct,
  getProductById,
  updateProduct,
  getProductByName,
} from "./warehouseClient.js";

const SERVER_ADDRESS = process.env.GRPC_SERVER_ADDRESS || "localhost:5230";

function printHeader(title) {
  console.log(`\n=======================================================`);
  console.log(`  ${title}`);
  console.log(`=======================================================`);
}

(async () => {
  const client = createClient(SERVER_ADDRESS);
  console.log(`Cliente gRPC conectado a ${SERVER_ADDRESS}`);

  // 1. Probar AddProduct (Llamadas Unarias)
  printHeader("1. AddProduct — Llamadas Unarias");
  const productos = [
    { id: "1", name: "Queso", quantity: 10 },
    { id: "2", name: "Papel", quantity: 20 },
    { id: "3", name: "Leche", quantity: 30 },
    { id: "1", name: "Queso Duplicado", quantity: 5 }, // Debe fallar por duplicado
  ];

  for (const p of productos) {
    try {
      const id = await addProduct(client, p.id, p.name, p.quantity);
      console.log(`Producto guardado — ID: ${id}, Nombre: ${p.name}, Stock: ${p.quantity}`);
    } catch (err) {
      console.error(`Error esperado con '${p.name}': [${err.code}] ${err.details}`);
    }
  }

  // 2. Probar GetProductById (Llamada Unaria)
  printHeader("2. GetProductById — Llamada Unaria");
  const ids = ["2", "99"]; // '99' no existe para probar error NotFound

  for (const id of ids) {
    try {
      const prod = await getProductById(client, id);
      console.log(`Encontrado: ID: ${prod.id}, Nombre: ${prod.name}, Stock: ${prod.quantity}`);
    } catch (err) {
      console.error(`Error al buscar ID '${id}': [${err.code}] ${err.details}`);
    }
  }

  // 3. Probar UpdateProduct (Llamada Unaria)
  printHeader("3. UpdateProduct — Llamada Unaria");
  try {
    const updated = await updateProduct(client, "1", "Queso Manchego", 45);
    console.log(`Actualizado con éxito: ID: ${updated.id}, Nombre: ${updated.name}, Stock: ${updated.quantity}`);
  } catch (err) {
    console.error(`Error al actualizar: [${err.code}] ${err.details}`);
  }

  // 4. Probar GetProductByName (Server Streaming)
  printHeader("4. GetProductByName — Server Streaming");
  const busquedas = ["Papel", "Inexistente"];

  for (const termino of busquedas) {
    console.log(`\nBuscando productos que contengan: "${termino}"`);
    try {
      const resultados = await getProductByName(client, termino);
      console.log(`Total recibidos vía stream: ${resultados.length}`);
    } catch (err) {
      console.error(`Error en streaming para '${termino}': [${err.code}] ${err.details}`);
    }
  }

  console.log("\n=======================================================");
  console.log("  Pruebas finalizadas con éxito.");
  console.log("=======================================================\n");
})();
```
## 4.3 Verificar el package.json en la carpeta NodeClient

Verificar que el archivo package.json tenga una información similar o la misma a esta:

```
{
  "name": "grpc-node-client",
  "version": "1.0.0",
  "description": "Cliente gRPC para el servicio Warehouse, implementado con @grpc/grpc-js",
  "main": "client.js",
  "type": "module",
  "scripts": {
    "start": "node client.js"
  },
  "dependencies": {
    "@grpc/grpc-js": "^1.12.0",
    "@grpc/proto-loader": "^0.7.15",
    "dotenv": "^18.0.8"
  }
}
```

---

## Parte 5 — Ejecución en VS Code

Para ejecutar la solución completa, abriremos dos terminales dentro de VS Code:

### 5.1 Terminal 1: Iniciar el Servidor .NET

```powershell
cd GrpcServer
dotnet run
```

Verás una salida similar a esta:
```
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: http://localhost:5230
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: https://localhost:7019
info: Microsoft.Hosting.Lifetime[0]
      Application started. Press Ctrl+C to shut down.
```

Deja esta terminal en ejecución.

### 5.2 Terminal 2: Ejecutar el Cliente Node.js

Abre una nueva pestaña de terminal en VS Code (`Ctrl+Shift+5` para dividir la terminal):

```powershell
cd NodeClient
npm start
```

### 5.3 Salida esperada en la consola del Cliente:

```text
Cliente gRPC conectado a localhost:5230

=======================================================
  1. AddProduct — Llamadas Unarias
=======================================================
Producto guardado — ID: 1, Nombre: Queso, Stock: 10
Producto guardado — ID: 2, Nombre: Papel, Stock: 20
Producto guardado — ID: 3, Nombre: Leche, Stock: 30
Error esperado con 'Queso Duplicado': [6] El producto con ID '1' ya existe.

=======================================================
  2. GetProductById — Llamada Unaria
=======================================================
Encontrado: ID: 2, Nombre: Papel, Stock: 20
Error al buscar ID '99': [5] No se encontró el producto con ID: 99

=======================================================
  3. UpdateProduct — Llamada Unaria
=======================================================
Actualizado con éxito: ID: 1, Nombre: Queso Manchego, Stock: 45

=======================================================
  4. GetProductByName — Server Streaming
=======================================================

Buscando productos que contengan: "Papel"
  [Stream] Recibido: Papel (Stock: 20)
Total recibidos vía stream: 1

Buscando productos que contengan: "Inexistente"
Error en streaming para 'Inexistente': [5] No se encontraron productos con el nombre: Inexistente

=======================================================
  Pruebas finalizadas con éxito.
=======================================================
```

---

## Parte 6 — Pruebas con Postman (Modo gRPC)

Postman cuenta con soporte nativo para gRPC. Puedes interactuar visualmente con el servidor sin necesidad de escribir código:

1. Abre Postman y haz clic en **New** > **gRPC Request**.
2. En la barra de dirección ingresa: `localhost:7019`.
3. Dirígete a la pestaña **Service definition** y selecciona **Import a .proto file**.
4. Selecciona tu archivo `GrpcServer/Protos/experimento.proto`.
5. En el menú desplegable de métodos verás disponibles los 4 procedimientos:

| Método gRPC | Mensaje JSON de prueba | Tipo |
|---|---|---|
| `warehouse.Warehouse/AddProduct` | `{"id": "10", "name": "Arroz", "quantity": 100}` | Unario |
| `warehouse.Warehouse/GetProductById` | `{"id": "10"}` | Unario |
| `warehouse.Warehouse/UpdateProduct` | `{"id": "10", "name": "Arroz Integral", "quantity": 80}` | Unario |
| `warehouse.Warehouse/GetProductByName` | `{"name": "Arroz"}` | Server Streaming |

> **Nota para Postman:** Al probar con el puerto HTTPS (`7019`), desactiva la verificación SSL en **Settings > General > SSL certificate verification: OFF**, ya que el certificado de desarrollo de ASP.NET Core es autofirmado.

---

## Solución de problemas frecuentes

| Problema | Causa probable | Solución |
|---|---|---|
| `Unhandled exception: System.IO.FileNotFoundException: Protos/experimento.proto` | La ruta en `.csproj` no coincide con el disco | Verifica que la carpeta se llame exactamente `Protos` y el archivo esté adentro |
| `Error: 14 UNAVAILABLE: No connection established` | El servidor no está corriendo o el puerto está bloqueado | Asegúrate de haber ejecutado `dotnet run` en `GrpcServer` antes que el cliente |
| `Error: 12 UNIMPLEMENTED: unknown service warehouse.Warehouse` | El servicio no fue registrado en el pipeline del servidor | Revisa en `Program.cs` que exista la línea `app.MapGrpcService<WarehouseService>();` |
| Fallo de certificado SSL en Node.js | `@grpc/grpc-js` rechaza certificados de desarrollo locales | Conéctate al puerto HTTP/2 sin TLS (`5230`) usando `grpc.credentials.createInsecure()` |
| `Cannot find package '@grpc/grpc-js'` | Falta instalar paquetes en el cliente | Ejecuta `npm install` dentro de la carpeta `NodeClient` |

---

## Lista de verificación para el entregable

Antes de dar por concluido tu proyecto, verifica que cumple con todos los puntos requeridos:

- [ ] Archivo `.proto` creado con sintaxis `proto3` conteniendo servicio, métodos y mensajes tipados.
- [ ] Servidor implementado en C# (.NET) heredando de la clase generada (`WarehouseBase`).
- [ ] Cliente implementado en Node.js consumiendo el contrato con `@grpc/grpc-js` y `@grpc/proto-loader`.
- [ ] Al menos una llamada **Unaria** implementada y validada (`GetProductById`, `AddProduct`, `UpdateProduct`).
- [ ] Al menos una llamada con **Server Streaming** implementada (`GetProductByName`).
- [ ] Manejo correcto de errores con códigos de estado gRPC (`NotFound`, `AlreadyExists`, `InvalidArgument`).
- [ ] Las dependencias se restauran correctamente con `dotnet restore` y `npm install`.
- [ ] El servidor y cliente se ejecutan simultáneamente en terminales de VS Code sin errores de conexión.
