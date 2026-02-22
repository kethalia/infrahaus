import { describe, it, expect } from "vitest";
import { prisma } from "./setup";
import { encrypt } from "../src/lib/encryption";

describe("Database Schema Relations", () => {
  describe("ProxmoxNode", () => {
    it("should create a ProxmoxNode with required fields", async () => {
      const node = await prisma.proxmoxNode.create({
        data: {
          name: "pve-node-1",
          host: "192.168.1.100",
          port: 8006,
          tokenId: "test@pam!token",
          tokenSecret: encrypt("test-secret"),
          fingerprint: "AA:BB:CC:DD:EE:FF",
          userId: "root@pam",
        },
      });

      expect(node.name).toBe("pve-node-1");
      expect(node.host).toBe("192.168.1.100");
      expect(node.port).toBe(8006);
      expect(node.userId).toBe("root@pam");
      expect(node.isDefault).toBe(false);
    });

    it("should enforce compound unique constraint (userId, name)", async () => {
      await prisma.proxmoxNode.create({
        data: {
          name: "unique-node",
          host: "192.168.1.60",
          userId: "root@pam",
        },
      });

      // Same userId + name should fail
      await expect(
        prisma.proxmoxNode.create({
          data: {
            name: "unique-node",
            host: "192.168.1.61",
            userId: "root@pam",
          },
        }),
      ).rejects.toThrow();

      // Different userId + same name should succeed
      const node2 = await prisma.proxmoxNode.create({
        data: {
          name: "unique-node",
          host: "192.168.1.62",
          userId: "admin@pve",
        },
      });
      expect(node2.name).toBe("unique-node");
    });
  });

  describe("Template → Scripts, Files, Packages relations", () => {
    it("should create a template with scripts, files, and packages", async () => {
      const template = await prisma.template.create({
        data: {
          name: "Test Template",
          description: "A test template",
          source: "custom",
          cores: 4,
          memory: 8192,
          diskSize: 20,
          unprivileged: true,
          nesting: true,
          scripts: {
            create: [
              {
                name: "00-setup.sh",
                order: 0,
                content: "#!/bin/bash\necho 'Setup'",
                description: "Initial setup script",
              },
              {
                name: "01-install.sh",
                order: 1,
                content: "#!/bin/bash\napt-get update",
                description: "Install dependencies",
              },
            ],
          },
          files: {
            create: [
              {
                name: "bashrc",
                targetPath: "/home/user/.bashrc",
                policy: "default",
                content: "alias ll='ls -la'",
              },
              {
                name: "gitconfig",
                targetPath: "/home/user/.gitconfig",
                policy: "replace",
                content: "[user]\n\tname = Test User",
              },
            ],
          },
          packages: {
            create: [
              { name: "curl", manager: "apt" },
              { name: "git", manager: "apt" },
              { name: "express", manager: "npm" },
            ],
          },
        },
        include: {
          scripts: true,
          files: true,
          packages: true,
        },
      });

      expect(template.scripts).toHaveLength(2);
      expect(template.files).toHaveLength(2);
      expect(template.packages).toHaveLength(3);
      expect(template.scripts[0].order).toBe(0);
      expect(template.files[0].policy).toBe("default");
      expect(template.packages[0].manager).toBe("apt");
    });

    it("should cascade delete scripts, files, and packages when template is deleted", async () => {
      const template = await prisma.template.create({
        data: {
          name: "Template to Delete",
          description: "Will be deleted",
          scripts: {
            create: [
              {
                name: "script.sh",
                order: 0,
                content: "echo test",
              },
            ],
          },
          files: {
            create: [
              {
                name: "config",
                targetPath: "/etc/config",
                policy: "replace",
                content: "config=true",
              },
            ],
          },
          packages: {
            create: [{ name: "vim", manager: "apt" }],
          },
        },
      });

      const scriptsBefore = await prisma.templateScript.count({
        where: { templateId: template.id },
      });
      const filesBefore = await prisma.templateFile.count({
        where: { templateId: template.id },
      });
      const packagesBefore = await prisma.package.count({
        where: { templateId: template.id },
      });

      expect(scriptsBefore).toBe(1);
      expect(filesBefore).toBe(1);
      expect(packagesBefore).toBe(1);

      await prisma.template.delete({
        where: { id: template.id },
      });

      const scriptsAfter = await prisma.templateScript.count({
        where: { templateId: template.id },
      });
      const filesAfter = await prisma.templateFile.count({
        where: { templateId: template.id },
      });
      const packagesAfter = await prisma.package.count({
        where: { templateId: template.id },
      });

      expect(scriptsAfter).toBe(0);
      expect(filesAfter).toBe(0);
      expect(packagesAfter).toBe(0);
    });
  });

  describe("PackageBucket → Package relation", () => {
    it("should create package bucket with packages", async () => {
      const bucket = await prisma.packageBucket.create({
        data: {
          name: "base-packages",
          description: "Base system packages",
          packages: {
            create: [
              { name: "curl", manager: "apt" },
              { name: "wget", manager: "apt" },
              { name: "git", manager: "apt" },
            ],
          },
        },
        include: {
          packages: true,
        },
      });

      expect(bucket.packages).toHaveLength(3);
      expect(bucket.packages.every((p) => p.bucketId === bucket.id)).toBe(true);
    });

    it("should cascade delete packages when bucket is deleted", async () => {
      const bucket = await prisma.packageBucket.create({
        data: {
          name: "temp-bucket",
          packages: {
            create: [
              { name: "package1", manager: "apt" },
              { name: "package2", manager: "npm" },
            ],
          },
        },
      });

      const packageCountBefore = await prisma.package.count({
        where: { bucketId: bucket.id },
      });
      expect(packageCountBefore).toBe(2);

      await prisma.packageBucket.delete({
        where: { id: bucket.id },
      });

      const packageCountAfter = await prisma.package.count({
        where: { bucketId: bucket.id },
      });
      expect(packageCountAfter).toBe(0);
    });
  });

  describe("Unique constraints", () => {
    it("should enforce unique Template name", async () => {
      await prisma.template.create({
        data: {
          name: "unique-template",
          description: "First template",
        },
      });

      await expect(
        prisma.template.create({
          data: {
            name: "unique-template",
            description: "Second template",
          },
        }),
      ).rejects.toThrow();
    });
  });
});
