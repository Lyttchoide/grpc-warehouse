using GrpcServer;
using GrpcServer.Services;
using Microsoft.AspNetCore.Server.Kestrel.Core;

// Cargar variables de entorno desde archivo .env si existe
LoadEnvFile();

var builder = WebApplication.CreateBuilder(args);

// Leer puertos desde variables de entorno con fallback a valores predeterminados
var httpPort = int.TryParse(Environment.GetEnvironmentVariable("GRPC_HTTP_PORT") ?? builder.Configuration["GRPC_HTTP_PORT"], out var p1) ? p1 : 5230;
var httpsPort = int.TryParse(Environment.GetEnvironmentVariable("GRPC_HTTPS_PORT") ?? builder.Configuration["GRPC_HTTPS_PORT"], out var p2) ? p2 : 7019;

// Configuración explícita de Kestrel para HTTP/2 en ambos puertos
builder.WebHost.ConfigureKestrel(options =>
{
    // Fuerza a Kestrel a escuchar HTTP/2 sin TLS en el puerto HTTP (cliente Node.js)
    options.ListenLocalhost(httpPort, o =>
    {
        o.Protocols = HttpProtocols.Http2;
    });

    // Fuerza a Kestrel a escuchar HTTP/2 con TLS en el puerto HTTPS (Postman y grpcurl)
    options.ListenLocalhost(httpsPort, o =>
    {
        o.Protocols = HttpProtocols.Http2;
        o.UseHttps();
    });
});

// Add services to the container.
builder.Services.AddSingleton<ErrorHandlingInterceptor>();

builder.Services.AddGrpc(options =>
{
    options.Interceptors.Add<ErrorHandlingInterceptor>();
});

builder.Services.AddGrpcReflection();

var app = builder.Build();

// Configure the HTTP request pipeline.
app.MapGrpcService<WarehouseService>();
app.MapGrpcReflectionService();
app.MapGet("/", () => "Communication with gRPC endpoints must be made through a gRPC client. To learn how to create a client, visit: https://go.microsoft.com/fwlink/?linkid=2086909");

app.Run();

// Función auxiliar para cargar variables de entorno desde archivo .env sin dependencias externas
static void LoadEnvFile()
{
    var currentDir = Directory.GetCurrentDirectory();
    var possiblePaths = new[]
    {
        Path.Combine(currentDir, ".env"),
        Path.Combine(currentDir, "..", ".env"),
        Path.Combine(AppContext.BaseDirectory, ".env")
    };

    var envPath = possiblePaths.FirstOrDefault(File.Exists);
    if (envPath == null) return;

    foreach (var line in File.ReadAllLines(envPath))
    {
        var trimmed = line.Trim();
        if (string.IsNullOrWhiteSpace(trimmed) || trimmed.StartsWith("#")) continue;

        var parts = trimmed.Split('=', 2);
        if (parts.Length == 2)
        {
            var key = parts[0].Trim();
            var value = parts[1].Trim().Trim('"', '\'');
            if (!string.IsNullOrEmpty(key) && Environment.GetEnvironmentVariable(key) == null)
            {
                Environment.SetEnvironmentVariable(key, value);
            }
        }
    }
}
