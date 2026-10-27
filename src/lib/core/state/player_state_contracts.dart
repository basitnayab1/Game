enum LoadState { idle, loading, success, empty, error }
class ApiState<T> { final LoadState state; final T? data; final String? message; const ApiState(this.state,{this.data,this.message}); }
class PlayerSessionState { final bool authenticated; final String? userId; const PlayerSessionState({required this.authenticated,this.userId}); }
