/* eslint-disable max-classes-per-file */
import http from "http";

type IMiddlewareNextFunction = () => Promise<any>;

interface IMiddleware<CTX> {
  (context: CTX, next: IMiddlewareNextFunction): any | Promise<any>;
}

class MiddlewareRunner<CTX> {
  middleware: IMiddleware<CTX>[] = [];

  middlewareCurrent = 0;

  use = (middleware: IMiddleware<CTX>) => {
    this.middleware.push(middleware);
  };

  run = async (context: CTX) => {
    this.middlewareCurrent = 0;
    let err: Error | null = null;
    const next = async () => {
      const middleware = this.middleware[this.middlewareCurrent];
      this.middlewareCurrent += 1;
      if (typeof middleware === "function") {
        try {
          const p = middleware(context, next);
          if (p instanceof Promise) {
            await p;
          }
        } catch (e) {
          // 运行中间件出错就执行下一个
          await next();
          err = e as Error;
        }
      }
    };
    await next();

    if (err) {
      throw err;
    }
    return context;
  };
}

type ServerListenParams = Parameters<http.Server["listen"]>;

interface Context {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  body?: any;
}

class Koa {
  runner = new MiddlewareRunner<Context>();

  listen(...args: ServerListenParams) {
    const server = http.createServer(async (req, res) => {
      const ctx: Context = {
        req,
        res,
      };
      await this.runner.run(ctx).catch((e) => this._errorHandler(e, ctx));
      ctx.res.end(ctx.body);
    });

    console.log("listen...", args[0]);

    server.listen(...args);
  }

  _errorHandler: (error: Error, ctx: Context) => Promise<void> = async () => {};

  useError(hander: (error: Error, ctx: Context) => Promise<void>) {
    this._errorHandler = hander;
  }

  use(middleware: IMiddleware<Context>) {
    this.runner.use(middleware);
  }
}

const m1: IMiddleware<Context> = async (ctx: Context, next) => {
  ctx.body = "success";
  await next();
};

const m2: IMiddleware<Context> = async (_ctx: Context, next) => {
  throw new Error("出错啦！");
};

const errorHandler = async (error: Error, ctx: Context) => {
  ctx.body = "出错啦！";
};

const koa = new Koa();

koa.useError(errorHandler); // 插入错误处理中间件
koa.use(m1);
koa.use(m2);

const port = 3101;

koa.listen(port, () => {
  setTimeout(() => {
    http
      .get(`http://localhost:${port}/`, (res) => {
        let rawData = `response from http://localhost:${port}/: `;
        res.on("data", (chunk) => {
          rawData += chunk;
        });
        res.on("end", () => {
          console.log(rawData);
        });
      })
      .on("error", (e) => {
        console.error(`Got error: ${e.message}`);
      });
  }, 1000);
});
