import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { logger } from './logging/structured-logger';
import dotenv from 'dotenv';

dotenv.config();

const client = new SecretManagerServiceClient();
const projectID = process.env.GOOGLE_CLOUD_PROJECT || 'dentacore-ai'; // Fallback to known project

/**
 * Fetches a secret from Google Cloud Secret Manager.
 * Falls back to process.env for local development.
 */
export async function getSecret(secretName: string): Promise<string> {
    // Always check ENV first for local override/development
    if (process.env[secretName]) {
        return process.env[secretName]!;
    }

    // If not in env, try Secret Manager (production logic)
    try {
        const [version] = await client.accessSecretVersion({
            name: `projects/${projectID}/secrets/${secretName}/versions/latest`,
        });

        const payload = version.payload?.data?.toString();
        if (!payload) {
            throw new Error(`Secret ${secretName} has no payload`);
        }

        return payload;
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to fetch secret ${secretName} from Secret Manager`, { error: errMsg });

        // In dev, we already checked ENV. This failure means the key is truly missing.
        throw new Error(`Secret ${secretName} is not defined in ENV or Secret Manager`);
    }
}

/**
 * Convenience method to load multiple secrets into a config object
 */
export async function loadSecrets(names: string[]): Promise<Record<string, string>> {
    const secrets: Record<string, string> = {};

    await Promise.all(
        names.map(async (name) => {
            secrets[name] = await getSecret(name);
        })
    );

    return secrets;
}
