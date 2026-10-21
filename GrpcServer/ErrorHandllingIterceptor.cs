using Grpc.Core;
using Grpc.Core.Interceptors;

namespace GrpcServer
{
    public class ErrorHandlingInterceptor : Interceptor
    {
        public override async Task<TResponse> UnaryServerHandler<TRequest, TResponse>(
            TRequest request,
            ServerCallContext context,
            UnaryServerMethod<TRequest, TResponse> continuation)
        {
            try
            {
                return await continuation(request, context);
            }
            catch (RpcException rpcEx)
            {
                // Manejar excepciones específicas de gRPC
                Console.WriteLine($"Excepción gRPC capturada en interceptor: {rpcEx.Status.Detail}");
                throw; // Relanzar la excepción para propagarla al cliente
            } 
            catch (Exception ex)
            {
                // Registrar la excepción o manejarla según sea necesario
                Console.WriteLine($"Excepción general capturada en interceptor: {ex.Message}");
                throw new RpcException(new Status(StatusCode.Internal, "Ocurrió un error al procesar la solicitud."));
            }
        }
    }
}