INSERT INTO managed_targets (id, type, name, display_name, description, enabled)
VALUES
  ('ssh', 'systemd', 'ssh.service', 'SSH Service', 'SSH remote access service', TRUE),
  ('docker', 'systemd', 'docker.service', 'Docker Engine', 'Docker daemon service', TRUE),
  ('rsp-api', 'docker', 'rsp-api', 'RSP API', 'Example API container', TRUE),
  ('remote-service-platform', 'compose', 'remote-service-platform', 'Remote Service Platform', 'Example compose project', TRUE)
ON CONFLICT DO NOTHING;
