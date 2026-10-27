enum AsyncStatus { idle, loading, success, empty, error }

class AsyncState<T> {
  final AsyncStatus status;
  final T? data;
  final String? message;
  const AsyncState(this.status, {this.data, this.message});

  const AsyncState.idle() : this(AsyncStatus.idle);
  const AsyncState.loading() : this(AsyncStatus.loading);
  const AsyncState.success(T data) : this(AsyncStatus.success, data: data);
  const AsyncState.empty() : this(AsyncStatus.empty);
  const AsyncState.error(String message) : this(AsyncStatus.error, message: message);
}
