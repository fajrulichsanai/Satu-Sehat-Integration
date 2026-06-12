import { Injectable } from '@nestjs/common';
import { ICD10_DATA } from './data/icd10.data';
import { ICD9_DATA } from './data/icd9.data';

@Injectable()
export class IcdService {
  searchIcd10(q: string, limit = 25): Array<{ code: string; display: string }> {
    if (!q || q.trim().length < 1) return [];
    const keyword = q.toLowerCase().trim();
    const results = ICD10_DATA.filter(
      (item) =>
        item.code.toLowerCase().includes(keyword) ||
        item.display.toLowerCase().includes(keyword),
    );
    return results.slice(0, Math.min(limit, 50));
  }

  searchIcd9(q: string, limit = 25): Array<{ code: string; display: string }> {
    if (!q || q.trim().length < 1) return [];
    const keyword = q.toLowerCase().trim();
    const results = ICD9_DATA.filter(
      (item) =>
        item.code.toLowerCase().includes(keyword) ||
        item.display.toLowerCase().includes(keyword),
    );
    return results.slice(0, Math.min(limit, 50));
  }
}
