declare module 'app' {
  export class Request {
    public subscribe(handler: (message: string) => void): void;
  }

  export class Response {
    public send(response: object) : void;
  }

  export interface Ports {
    request: Request;
    response: Response;
  }

  export class App {
    ports: Ports;
  }
}