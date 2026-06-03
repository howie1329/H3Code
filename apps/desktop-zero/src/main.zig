const std = @import("std");
const runner = @import("runner");
const zero_native = @import("zero-native");

pub const panic = std.debug.FullPanic(zero_native.debug.capturePanic);

const App = struct {
    env_map: *std.process.Environ.Map,
    io: std.Io,
    sidecar: ?std.process.Child = null,
    bridge_handlers: [4]zero_native.BridgeHandler = undefined,

    fn app(self: *@This()) zero_native.App {
        return .{
            .context = self,
            .name = "h3code-desktop-zero",
            .source = zero_native.frontend.productionSource(.{ .dist = "../desktop/build" }),
            .source_fn = source,
            .stop_fn = stop,
        };
    }

    fn source(context: *anyopaque) anyerror!zero_native.WebViewSource {
        const self: *@This() = @ptrCast(@alignCast(context));
        return zero_native.frontend.sourceFromEnv(self.env_map, .{
            .dist = "../desktop/build",
            .entry = "index.html",
        });
    }

    fn bridge(self: *@This()) zero_native.BridgeDispatcher {
        const origins = &.{ "zero://app", "http://127.0.0.1:5173" };
        const policies = &.{
            zero_native.BridgeCommandPolicy{ .name = "h3code.getAppVersion", .origins = origins },
            zero_native.BridgeCommandPolicy{ .name = "h3code.getAgentServerUrl", .origins = origins },
            zero_native.BridgeCommandPolicy{ .name = "h3code.revealPath", .origins = origins },
            zero_native.BridgeCommandPolicy{ .name = "h3code.revealPreferencesDatabase", .origins = origins },
        };

        self.bridge_handlers = .{
            .{ .name = "h3code.getAppVersion", .context = self, .invoke_fn = getAppVersion },
            .{ .name = "h3code.getAgentServerUrl", .context = self, .invoke_fn = getAgentServerUrl },
            .{ .name = "h3code.revealPath", .context = self, .invoke_fn = unsupportedShellAction },
            .{ .name = "h3code.revealPreferencesDatabase", .context = self, .invoke_fn = unsupportedShellAction },
        };

        return .{
            .policy = .{ .enabled = true, .commands = policies },
            .registry = .{ .handlers = &self.bridge_handlers },
        };
    }

    fn startSidecar(self: *@This()) !void {
        std.Io.Dir.cwd().createDirPath(self.io, data_dir) catch {};
        std.Io.Dir.cwd().deleteFile(self.io, agent_server_state_file) catch {};

        const args = [_][]const u8{
            "node",
            "sidecar/agent-server.mjs",
            data_dir,
            agent_server_state_file,
        };

        self.sidecar = try std.process.spawn(self.io, .{
            .argv = &args,
            .stdin = .ignore,
            .stdout = .inherit,
            .stderr = .inherit,
        });

        try self.waitForAgentServer();
    }

    fn waitForAgentServer(self: *@This()) !void {
        var attempt: u16 = 0;
        while (attempt < 200) : (attempt += 1) {
            if (std.Io.Dir.cwd().openFile(self.io, agent_server_state_file, .{})) |file| {
                file.close(self.io);
                return;
            } else |_| {
                std.Io.sleep(self.io, std.Io.Duration.fromMilliseconds(50), .awake) catch {};
            }
        }

        return error.AgentServerSidecarNotReady;
    }

    fn stop(context: *anyopaque, _: *zero_native.Runtime) anyerror!void {
        const self: *@This() = @ptrCast(@alignCast(context));
        if (self.sidecar) |*child| {
            child.kill(self.io);
            self.sidecar = null;
        }
    }
};

const data_dir = ".zig-cache/h3code-zero-data";
const agent_server_state_file = ".zig-cache/h3code-zero-data/agent-server.json";
const dev_origins = [_][]const u8{ "zero://app", "zero://inline", "http://127.0.0.1:5173" };
const builtin_bridge_policies = [_]zero_native.BridgeCommandPolicy{
    .{ .name = "zero-native.dialog.openFile", .origins = &dev_origins },
};

pub fn main(init: std.process.Init) !void {
    var app = App{ .env_map = init.environ_map, .io = init.io };
    try app.startSidecar();
    try runner.runWithOptions(app.app(), .{
        .app_name = "H3Code Zero Prototype",
        .window_title = "H3Code Zero Prototype",
        .bundle_id = "dev.h3code.desktop-zero",
        .icon_path = "assets/icon.icns",
        .window_width = 1200,
        .window_height = 800,
        .bridge = app.bridge(),
        .builtin_bridge = .{ .enabled = true, .commands = &builtin_bridge_policies },
        .security = .{
            .navigation = .{ .allowed_origins = &dev_origins },
        },
    }, init);
}

test "app name is configured" {
    try std.testing.expectEqualStrings("h3code-desktop-zero", "h3code-desktop-zero");
}

fn getAppVersion(_: *anyopaque, _: zero_native.bridge.Invocation, output: []u8) anyerror![]const u8 {
    return zero_native.bridge.writeJsonStringValue(output, "0.0.0-zero-prototype");
}

fn getAgentServerUrl(context: *anyopaque, _: zero_native.bridge.Invocation, output: []u8) anyerror![]const u8 {
    const self: *App = @ptrCast(@alignCast(context));
    var file = try std.Io.Dir.cwd().openFile(self.io, agent_server_state_file, .{});
    defer file.close(self.io);

    var read_buffer: [4096]u8 = undefined;
    var stream_buffer: [4096]u8 = undefined;
    var reader = file.reader(self.io, &stream_buffer);
    const len = try reader.interface.readSliceShort(&read_buffer);
    const bytes = read_buffer[0..len];

    return std.fmt.bufPrint(output, "{s}", .{bytes});
}

fn unsupportedShellAction(_: *anyopaque, invocation: zero_native.bridge.Invocation, _: []u8) anyerror![]const u8 {
    std.debug.print("unsupported prototype shell command: {s}\n", .{invocation.request.command});
    return error.UnsupportedPrototypeShellAction;
}
