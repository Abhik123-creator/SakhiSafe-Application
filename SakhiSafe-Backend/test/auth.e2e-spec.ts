import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { AuthController } from '../src/auth/controllers/auth.controller';
import { AuthService } from '../src/auth/services/auth.service';
import { LocalAuthGuard } from '../src/auth/guards/local-auth.guard';

describe('Auth login endpoint', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: { login: jest.fn().mockResolvedValue({ accessToken: 'token' }) } }],
    })
      .overrideGuard(LocalAuthGuard)
      .useValue({
        canActivate: (context) => {
          context.switchToHttp().getRequest().user = { id: 'user-id', email: 'admin@sakhisafe.local', roles: ['SUPER_ADMIN'] };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/auth/login returns a token', () => {
    return request(app.getHttpServer()).post('/auth/login').send({ email: 'admin@sakhisafe.local', password: 'Admin@12345' }).expect(201).expect((res) => {
      expect(res.body.accessToken).toBe('token');
    });
  });
});
