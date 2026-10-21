using Grpc.Core;

namespace GrpcServer.Services
{
    public class WarehouseService : Warehouse.WarehouseBase
    {
        private static readonly Dictionary<string, Product> _products = new Dictionary<string, Product>();

        // Llamada RPC Unaria: Obtener un producto individual por ID
        public override Task<Product> GetProductById(ProductID request, ServerCallContext context)
        {
            if (_products.TryGetValue(request.Id, out Product? product) && product != null)
            {
                return Task.FromResult(product);
            }

            throw new RpcException(new Status(StatusCode.NotFound, $"No se encontró el producto con ID: {request.Id}"));
        }

        // Llamada RPC con Streaming de Servidor: Buscar productos por nombre y transmitir coincidencias en flujo continuo
        public override async Task GetProductByName(ProductName request, IServerStreamWriter<Product> responseStream, ServerCallContext context)
        {
            var matchingProducts = _products.Values
                .Where(p => p.Name.Contains(request.Name, StringComparison.OrdinalIgnoreCase))
                .ToList();

            if (matchingProducts.Count == 0)
            {
                throw new RpcException(new Status(StatusCode.NotFound, $"No se encontraron productos con el nombre: {request.Name}"));
            }

            foreach (var product in matchingProducts)
            {
                await responseStream.WriteAsync(product);
                // Pequeña pausa para demostrar el comportamiento del streaming
                await Task.Delay(200);
            }
        }

        // Llamada RPC Unaria: Agregar un nuevo producto
        public override Task<ProductID> AddProduct(Product request, ServerCallContext context)
        {
            if (string.IsNullOrWhiteSpace(request.Id))
            {
                throw new RpcException(new Status(StatusCode.InvalidArgument, "El ID del producto no puede estar vacío."));
            }

            if (_products.ContainsKey(request.Id))
            {
                throw new RpcException(new Status(StatusCode.AlreadyExists, $"El producto con ID '{request.Id}' ya existe en el almacén."));
            }

            _products[request.Id] = request;
            return Task.FromResult(new ProductID { Id = request.Id });
        }

        // Llamada RPC Unaria: Actualizar un producto existente
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