import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { ListNewsQueryDto } from './dto/list-news-query.dto';
import { NewsService, type NewsListItem, type NewsListResponse } from './news.service';

/** Read-only, public — the news feed and article pages (Day 15). */
@Controller('news')
export class NewsController {
  constructor(private readonly news: NewsService) {}

  @Get()
  async list(@Query() query: ListNewsQueryDto): Promise<NewsListResponse> {
    return this.news.list(query);
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<NewsListItem> {
    if (!isUUID(id)) {
      throw new NotFoundException({ error: 'not_found', message: 'No article with that id.' });
    }
    const item = await this.news.getById(id);
    if (!item) throw new NotFoundException({ error: 'not_found', message: 'No article with that id.' });
    return item;
  }
}
