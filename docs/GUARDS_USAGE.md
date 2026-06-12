# Guards & Decorators Usage Guide

## 📚 Available Guards

### 1. **JwtAuthGuard** (Global)
Validates JWT token and populates `req.user`.

**Applied globally** via `APP_GUARD` in `app.module.ts`.

**Skip with:**
```typescript
@Public()
@Get('public-endpoint')
```

---

### 2. **RolesGuard**
Checks if user has required role(s).

**Usage:**
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN)
@Get('admin-only')
async adminEndpoint() { ... }
```

---

### 3. **ClinicContextGuard**
Ensures multi-tenant isolation by validating `clinicId`.

**Usage:**
```typescript
@UseGuards(JwtAuthGuard, ClinicContextGuard)
@Get('clinic-data')
async getClinicData(@ClinicId() clinicId: number) {
  // Auto-filtered by clinic
  return this.service.findAll(clinicId);
}
```

**Skip clinic check:**
```typescript
@SkipClinicCheck()
@Get('all-clinics')
async getAllClinics() { ... }
```

---

### 4. **IsActiveGuard**
Validates user account is active.

**Usage:**
```typescript
@UseGuards(JwtAuthGuard, IsActiveGuard)
@Post('critical-action')
async criticalAction() { ... }
```

_Note: JWT strategy already validates `isActive`, so this guard is redundant unless needed for explicit checks._

---

## 🎨 Available Decorators

### 1. **@Public()**
Skip JWT authentication.

```typescript
@Public()
@Post('login')
async login() { ... }
```

---

### 2. **@Roles(...roles)**
Specify required roles.

```typescript
@Roles(UserRole.OWNER)
@Delete(':id')
async delete() { ... }
```

---

### 3. **@CurrentUser()**
Get authenticated user from request.

```typescript
@Get('profile')
async getProfile(@CurrentUser() user: JwtPayload) {
  // user = { userId, email, role, clinicId, practitionerId }
  return user;
}
```

---

### 4. **@ClinicId()**
Get clinic ID from request (populated by `ClinicContextGuard`).

```typescript
@Get('patients')
async findAll(@ClinicId() clinicId: number) {
  return this.patientService.findByClinic(clinicId);
}
```

---

### 5. **@SkipClinicCheck()**
Skip clinic context validation.

```typescript
@SkipClinicCheck()
@Get('system-wide-stats')
async getStats() { ... }
```

---

## 🔐 Common Patterns

### Pattern 1: Owner-only endpoint
```typescript
@UseGuards(RolesGuard)
@Roles(UserRole.OWNER)
@Post('activate-user')
async activateUser(@Param('id') id: number) { ... }
```

---

### Pattern 2: Admin or Owner
```typescript
@UseGuards(RolesGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN)
@Get('users')
async listUsers() { ... }
```

---

### Pattern 3: Clinic-scoped data (multi-tenant)
```typescript
@UseGuards(RolesGuard, ClinicContextGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DOKTER)
@Get('patients')
async getPatients(
  @CurrentUser() user: JwtPayload,
  @ClinicId() clinicId: number,
) {
  // Auto-filtered by clinicId
  return this.patientService.findByClinic(clinicId);
}
```

---

### Pattern 4: Dokter sees only their own data
```typescript
@UseGuards(RolesGuard, ClinicContextGuard)
@Roles(UserRole.DOKTER)
@Get('my-encounters')
async getMyEncounters(
  @CurrentUser() user: JwtPayload,
  @ClinicId() clinicId: number,
) {
  // Filter by practitionerId
  return this.encounterService.findByPractitioner(
    clinicId,
    user.practitionerId,
  );
}
```

---

### Pattern 5: Public endpoint (no auth)
```typescript
@Public()
@Get('clinic-info')
async getClinicInfo() { ... }
```

---

## 🏗️ Guard Execution Order

```
1. JwtAuthGuard (global)
   ↓
2. RolesGuard (if applied)
   ↓
3. ClinicContextGuard (if applied)
   ↓
4. IsActiveGuard (if applied)
   ↓
5. Controller method
```

**Important:** Apply guards in correct order:
```typescript
@UseGuards(JwtAuthGuard, RolesGuard, ClinicContextGuard)
```

---

## ⚠️ Security Best Practices

1. **Always use `@UseGuards(RolesGuard)` with `@Roles()`**
   ```typescript
   // ❌ BAD - Role decorator without guard
   @Roles(UserRole.OWNER)
   @Get()
   
   // ✅ GOOD
   @UseGuards(RolesGuard)
   @Roles(UserRole.OWNER)
   @Get()
   ```

2. **Filter by clinicId in service layer**
   ```typescript
   // Even with ClinicContextGuard, always filter in queries
   async findAll(clinicId: number) {
     return this.repo.find({ where: { clinicId } });
   }
   ```

3. **Dokter role: Always filter by practitionerId**
   ```typescript
   if (user.role === UserRole.DOKTER) {
     query.andWhere('encounter.practitionerId = :pid', {
       pid: user.practitionerId,
     });
   }
   ```

4. **Use `@Public()` sparingly**
   - Only for truly public endpoints
   - Examples: login, register, public queue check

---

## 🧪 Testing Endpoints

See `/examples` endpoints for live demos:
- `GET /examples/public-authed` - Any authenticated user
- `GET /examples/owner-only` - Owner only
- `GET /examples/admin-access` - Owner or Admin
- `GET /examples/clinic-data` - Clinic-scoped
- `GET /examples/my-patients` - Dokter only

---

**Last Updated:** 2026-06-11
