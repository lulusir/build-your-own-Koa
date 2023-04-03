觉得有帮助的同学记得给个star，谢谢
# 手把手教你实现一个Koa
## koa是什么

Koa 是一个基于 Node.js 的 Web 服务器库，其核心思想是中间件模式。相比其他框架（如 Express），Koa 更加轻量级、简洁、易扩展，且支持异步操作。

在 Koa 中，中间件是一个函数，其可以访问 HTTP 请求和响应对象，以及 next 函数，通过调用 next 函数可以将控制权交给下一个中间件。Koa 中间件的执行顺序与注册顺序相同，可以使用 async/await 实现异步操作。

关于中间件模式，之前我写过一篇文章介绍如何实现，不了解的可以查看[使用Typescript实现中间件模式，顺便发了个npm包](https://juejin.cn/post/7174802901766766650)

接下来我们来实现一个自己的 Koa，当然，这里只包含简单的核心功能，即一个基于中间件模式的服务器。

## 中间件
首先是核心的中间件代码，功能就不过多介绍了，不了解的可以查看之前的文章[使用Typescript实现中间件模式，顺便发了个npm包](https://juejin.cn/post/7174802901766766650)

另外，这个中间件也单独发了 npm 包，你可以使用在你需要的地方：
```bash
npm install @lujs/middleware
```
```typescript
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
    let err: Error | null = null;
    this.middlewareCurrent = 0;
    const next = async () => {
      const middleware = this.middleware[this.middlewareCurrent];
      this.middlewareCurrent += 1;
      if (typeof middleware === 'function') {
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
```
## Context
接下来声明我们的context，这个context会在每个中间件中流转，在koa中对context做了封装，我们这里为了方便演示，直接使用http的req和res作为context的内容；这里的body则是最后响应到http接口的body
```typescript
interface Context {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  body?: any;
}
```
## core核心代码
其实核心代码就这几行，Koa类，内置一个MiddlewareRunner，用来记录和运行中间件；

use方法则是注册中间件

listen方法则是启动一个http服务，然后运行内置的MiddlewareRunner
```typescript
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

    console.log('listen...', args[0]);

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
```

## 实现中间件的错误处理
上面的代码中，我们已经实现了一个基于中间件模式的 Koa，但是还没有加入错误处理的功能。在实际开发中，错误处理是非常重要的一部分。为了方便演示，我们先编写一个会出现错误的中间件，然后加入错误处理代码。这里我们定义一个名为 m2 的中间件，在这个中间件中，我们主动触发一个错误
```typescript
const m2: IMiddleware<Context> = async (_ctx: Context, next) => {
  throw new Error('出错啦！');
};

const errorHandler: IMiddleware<Context> = async (ctx: Context, next) => {
  try {
    await next();
  } catch (err) {
    console.error(err);
    ctx.body = '出错啦！';
  }
};

```
## 运行
接下来我们把自己的koa跑起来，然后发一个请求看看是否成功响应
```typescript
const m1: IMiddleware<Context> = async (ctx: Context, next) => {
  ctx.body = 'success';
  await next();
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
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          console.log(rawData);
        });
      })
      .on('error', (e) => {
        console.error(`Got error: ${e.message}`);
      });
  }, 1000);
});



```
[中间件源码](https://github.com/lulusir/middleware)，期待你的star，谢谢！



